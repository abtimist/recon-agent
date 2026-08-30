"""
Core reconciliation logic.

Works entirely on the standardized internal schema (id, party, amount, date)
produced by core/column_mapper.py — this is what makes it work with ANY CSV
format, regardless of what the source platform calls its columns.

Matching strategy (cheapest → most expensive):
  1. Exact match on normalised id.
  2. Fuzzy match on (party name similarity + amount within tolerance + date
     within window) for rows where the id doesn't match exactly.
  3. Anything still unresolved goes to the AI resolver as an "ambiguous" case.
  4. Anything the AI can't confidently resolve either goes into the exception list.

Performance design (fuzzy matching)
------------------------------------
Naïve O(n×m) — iterate every source row against every target row — is fine
for a few hundred rows but becomes painful at tens of thousands.

Optimisation: two-stage candidate reduction before the expensive string comparison.

  Stage 1 — date window (binary search, O(log m)):
    Sort the target array by date ordinal once.  For each source row use
    numpy.searchsorted to slice only the rows whose date falls within ±window days.
    At ±5 days over a 30-day month that's ~33 % of rows in the worst case;
    in practice many gaps are larger so the slice is much smaller.

  Stage 2 — amount tolerance (vectorised numpy, O(k)):
    Apply numpy absolute-difference filter on the date-window slice.
    Amounts usually differ by at most fees (~1 %), so this cuts the candidates
    down to a handful.

  Stage 3 — fuzzy name match (rapidfuzz, O(k)):
    rapidfuzz.process.extractOne runs the Levenshtein ratio against only the
    surviving candidates from stages 1+2.  k is typically 1–5, so this is
    effectively O(1) per source row.

Overall complexity: O(n log m + n·k) where k << m.

Party-optional mode
--------------------
If a file was uploaded without a party/merchant column, the standardised
DataFrame has empty strings in the "party" column.  In that case we skip the
fuzzy name check entirely and consider amount+date agreement sufficient
evidence for a confident match.
"""

import numpy as np
import pandas as pd
from rapidfuzz import fuzz
from rapidfuzz import process as rf_process


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def normalize_id(value: str) -> str:
    """Strip everything that isn't alphanumeric to make IDs compare cleanly."""
    return "".join(ch for ch in str(value).lower() if ch.isalnum())


def _has_party(df: pd.DataFrame) -> bool:
    """Return True if this DataFrame has meaningful party data (not all empty)."""
    return "party" in df.columns and df["party"].str.strip().ne("").any()


# ---------------------------------------------------------------------------
# Stage 1 – Exact match
# ---------------------------------------------------------------------------

def exact_match(
    source_df: pd.DataFrame,
    target_df: pd.DataFrame,
) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    """
    Match on normalised id.  Both DataFrames must be in the standard schema.
    Returns (matched, unmatched_source, unmatched_target).
    """
    src = source_df.copy()
    tgt = target_df.copy()

    src["_norm_id"] = src["id"].apply(normalize_id)
    tgt["_norm_id"] = tgt["id"].apply(normalize_id)

    merged = src.merge(tgt, on="_norm_id", suffixes=("_source", "_target"))

    matched_src_ids = set(merged["id_source"])
    matched_tgt_ids = set(merged["id_target"])

    unmatched_source = src[~src["id"].isin(matched_src_ids)].drop(columns=["_norm_id"])
    unmatched_target = tgt[~tgt["id"].isin(matched_tgt_ids)].drop(columns=["_norm_id"])

    merged["match_type"] = "exact_id"
    merged["confidence"] = 1.0
    merged = merged.drop(columns=["_norm_id"])

    return merged, unmatched_source.reset_index(drop=True), unmatched_target.reset_index(drop=True)


# ---------------------------------------------------------------------------
# Stage 2 – Fuzzy match (optimised)
# ---------------------------------------------------------------------------

import concurrent.futures

def _score_source_row(args):
    """Helper for parallel processing of source rows."""
    src_row, tgt_date_arr, tgt_amount_arr, tgt_party_arr, amount_tolerance, date_window_days, use_party_scoring = args
    
    src_date = pd.to_datetime(src_row["date"], errors="coerce")
    if pd.isna(src_date):
        return (src_row, None, 0, None)
        
    src_ord    = src_date.toordinal()
    src_amount = float(src_row["amount"])
    src_party  = str(src_row["party"]).lower() if use_party_scoring else ""

    lo = int(np.searchsorted(tgt_date_arr, src_ord - date_window_days, side="left"))
    hi = int(np.searchsorted(tgt_date_arr, src_ord + date_window_days, side="right"))

    if lo >= hi:
        return (src_row, None, 0, None)

    candidate_positions = list(range(lo, hi))
    cand_pos_arr    = np.array(candidate_positions, dtype=np.int64)
    cand_amounts    = tgt_amount_arr[cand_pos_arr]
    amount_mask     = np.abs(cand_amounts - src_amount) <= amount_tolerance
    filtered_pos    = cand_pos_arr[amount_mask].tolist()

    if not filtered_pos:
        return (src_row, None, 0, None)

    if use_party_scoring:
        choices = {pos: tgt_party_arr[pos] for pos in filtered_pos}
        result  = rf_process.extractOne(
            src_party, choices,
            scorer=fuzz.ratio,
            score_cutoff=60,
        )
        if result is None:
            return (src_row, None, 0, None)
        _best_name, best_score, best_pos = result
    else:
        best_pos   = min(filtered_pos, key=lambda p: abs(tgt_amount_arr[p] - src_amount))
        best_score = 90

    return (src_row, best_pos, best_score, "fuzzy_high_confidence" if best_score >= 85 else "ambiguous")


def fuzzy_match(
    unmatched_source: pd.DataFrame,
    unmatched_target: pd.DataFrame,
    amount_tolerance: float = 20.0,
    date_window_days: int = 5,
) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame, list]:
    """
    Attempt to match remaining rows using amount proximity, date proximity,
    and (if available) party name similarity.

    The optimised approach uses a Map-Reduce pattern:
      1. Map: ProcessPoolExecutor distributes source rows across CPU cores.
              Each core uses numpy binary search to find candidates and rapidfuzz to score them.
      2. Reduce: Sort all discovered matches by confidence descending, and greedily
                 claim target rows to prevent double-spending.
    """
    if unmatched_source.empty or unmatched_target.empty:
        return (pd.DataFrame(), unmatched_source, unmatched_target, [])

    source_has_party = _has_party(unmatched_source)
    target_has_party = _has_party(unmatched_target)
    use_party_scoring = source_has_party and target_has_party

    tgt = unmatched_target.copy()
    tgt["date"] = pd.to_datetime(tgt["date"], errors="coerce")
    tgt["_date_ord"] = tgt["date"].apply(lambda d: d.toordinal() if pd.notna(d) else 0)
    tgt = tgt.sort_values("_date_ord").reset_index(drop=True)

    tgt_date_arr   = tgt["_date_ord"].to_numpy(dtype=np.int64)
    tgt_amount_arr = tgt["amount"].to_numpy(dtype=np.float64)
    tgt_party_arr  = tgt["party"].str.lower().tolist() if use_party_scoring else None

    if len(unmatched_source) <= 1000:
        # Strict sequential loop for small datasets (guarantees parity with naive approach)
        matched_rows      = []
        ambiguous_pairs   = []
        used_positions    = set()
        remaining_source  = []

        for _, src_row in unmatched_source.iterrows():
            src_date = pd.to_datetime(src_row["date"], errors="coerce")
            if pd.isna(src_date):
                remaining_source.append(src_row)
                continue
                
            src_ord    = src_date.toordinal()
            src_amount = float(src_row["amount"])
            src_party  = str(src_row["party"]).lower() if use_party_scoring else ""
            
            lo = int(np.searchsorted(tgt_date_arr, src_ord - date_window_days, side="left"))
            hi = int(np.searchsorted(tgt_date_arr, src_ord + date_window_days, side="right"))
            
            if lo >= hi:
                remaining_source.append(src_row)
                continue
                
            candidate_positions = [i for i in range(lo, hi) if i not in used_positions]
            if not candidate_positions:
                remaining_source.append(src_row)
                continue
                
            cand_pos_arr    = np.array(candidate_positions, dtype=np.int64)
            cand_amounts    = tgt_amount_arr[cand_pos_arr]
            amount_mask     = np.abs(cand_amounts - src_amount) <= amount_tolerance
            filtered_pos    = cand_pos_arr[amount_mask].tolist()
            
            if not filtered_pos:
                remaining_source.append(src_row)
                continue
                
            if use_party_scoring:
                choices = {pos: tgt_party_arr[pos] for pos in filtered_pos}
                result  = rf_process.extractOne(
                    src_party, choices,
                    scorer=fuzz.ratio,
                    score_cutoff=60,
                )
                if result is None:
                    remaining_source.append(src_row)
                    continue
                _best_name, best_score, best_pos = result
            else:
                best_pos   = min(filtered_pos, key=lambda p: abs(tgt_amount_arr[p] - src_amount))
                best_score = 90
                
            tgt_row = tgt.iloc[best_pos]
            record = {
                "id_source":     src_row["id"],
                "party_source":  src_row["party"],
                "amount_source": src_row["amount"],
                "date_source":   src_row["date"],
                "id_target":     tgt_row["id"],
                "party_target":  tgt_row["party"],
                "amount_target": tgt_row["amount"],
                "date_target":   tgt_row["date"],
            }
            if best_score >= 85:
                matched_rows.append({
                    **record,
                    "match_type": "fuzzy_high_confidence",
                    "confidence": round(best_score / 100, 2),
                })
                used_positions.add(best_pos)
            else:
                ambiguous_pairs.append((src_row.to_dict(), tgt_row.to_dict()))
                used_positions.add(best_pos)
                
    else:
        # Map-Reduce approach for large datasets (>1000 rows) using ProcessPoolExecutor
        tasks = []
        for _, src_row in unmatched_source.iterrows():
            tasks.append((src_row, tgt_date_arr, tgt_amount_arr, tgt_party_arr, amount_tolerance, date_window_days, use_party_scoring))

        import os
        max_workers = min(8, (os.cpu_count() or 1) + 4)
        with concurrent.futures.ProcessPoolExecutor(max_workers=max_workers) as executor:
            results = list(executor.map(_score_source_row, tasks, chunksize=100))

        candidates = []
        failed_src_rows = []
        for res in results:
            src_row, best_pos, best_score, match_type = res
            if best_pos is not None:
                candidates.append(res)
            else:
                failed_src_rows.append(src_row)
                
        candidates.sort(key=lambda x: x[2], reverse=True)

        matched_rows      = []
        ambiguous_pairs   = []
        used_positions    = set()
        remaining_source  = failed_src_rows

        for src_row, best_pos, best_score, match_type in candidates:
            if best_pos in used_positions:
                remaining_source.append(src_row)
                continue
                
            used_positions.add(best_pos)
            tgt_row = tgt.iloc[best_pos]

            record = {
                "id_source":     src_row["id"],
                "party_source":  src_row["party"],
                "amount_source": src_row["amount"],
                "date_source":   src_row["date"],
                "id_target":     tgt_row["id"],
                "party_target":  tgt_row["party"],
                "amount_target": tgt_row["amount"],
                "date_target":   tgt_row["date"],
            }

            if match_type == "fuzzy_high_confidence":
                matched_rows.append({
                    **record,
                    "match_type": "fuzzy_high_confidence",
                    "confidence": round(best_score / 100, 2),
                })
            else:
                ambiguous_pairs.append((src_row.to_dict(), tgt_row.to_dict()))

    matched_df = pd.DataFrame(matched_rows)

    still_unmatched_source = (
        pd.DataFrame(remaining_source, columns=unmatched_source.columns)
        if remaining_source
        else pd.DataFrame(columns=unmatched_source.columns)
    )

    still_unmatched_target = tgt[~tgt.index.isin(used_positions)].drop(
        columns=["_date_ord"], errors="ignore"
    )

    return matched_df, still_unmatched_source, still_unmatched_target, ambiguous_pairs
