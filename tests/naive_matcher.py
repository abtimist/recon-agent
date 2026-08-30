import pandas as pd
from rapidfuzz import fuzz

def naive_fuzzy_match(
    unmatched_source: pd.DataFrame,
    unmatched_target: pd.DataFrame,
    amount_tolerance: float = 20.0,
    date_window_days: int = 5,
) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame, list]:
    """
    Naive O(n * m) implementation of fuzzy_match for regression testing.
    """
    if unmatched_source.empty or unmatched_target.empty:
        return pd.DataFrame(), unmatched_source, unmatched_target, []

    source_has_party = "party" in unmatched_source.columns and unmatched_source["party"].str.strip().ne("").any()
    target_has_party = "party" in unmatched_target.columns and unmatched_target["party"].str.strip().ne("").any()
    use_party_scoring = source_has_party and target_has_party

    matched_rows = []
    ambiguous_pairs = []
    used_target_indices = set()
    remaining_source = []
    
    tgt = unmatched_target.copy()
    
    # Pre-parse dates and sort to match tie-breaking behavior of optimized matcher
    tgt["_date_pd"] = pd.to_datetime(tgt["date"], errors="coerce")
    tgt["_date_ord"] = tgt["_date_pd"].apply(lambda d: d.toordinal() if pd.notna(d) else 0)
    tgt = tgt.sort_values("_date_ord").reset_index(drop=True)
    
    for src_idx, src_row in unmatched_source.iterrows():
        src_date = pd.to_datetime(src_row["date"], errors="coerce")
        if pd.isna(src_date):
            remaining_source.append(src_row)
            continue
            
        src_amount = float(src_row["amount"])
        src_party = str(src_row["party"]).lower() if use_party_scoring else ""
        
        best_pos = None
        best_score = -1
        best_amount_diff = float('inf')
        
        for tgt_idx, tgt_row in tgt.iterrows():
            if tgt_idx in used_target_indices:
                continue
                
            tgt_date = tgt_row["_date_pd"]
            if pd.isna(tgt_date):
                continue
                
            date_diff = abs((src_date - tgt_date).days)
            if date_diff > date_window_days:
                continue
                
            tgt_amount = float(tgt_row["amount"])
            amount_diff = abs(tgt_amount - src_amount)
            if amount_diff > amount_tolerance:
                continue
                
            if use_party_scoring:
                tgt_party = str(tgt_row["party"]).lower()
                score = fuzz.ratio(src_party, tgt_party)
                if score > best_score:
                    best_score = score
                    best_pos = tgt_idx
                    best_amount_diff = amount_diff
                elif score == best_score:
                    # break ties with amount diff, then with date diff
                    pass # Keep it simple for naive, optimized does not strictly break ties same way
            else:
                score = 90
                if amount_diff < best_amount_diff:
                    best_amount_diff = amount_diff
                    best_score = score
                    best_pos = tgt_idx
                    
        if best_pos is not None:
            # We found a candidate.
            if use_party_scoring and best_score < 60:
                remaining_source.append(src_row)
                continue
                
            tgt_row = tgt.loc[best_pos]
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
                used_target_indices.add(best_pos)
            else:
                ambiguous_pairs.append((src_row.to_dict(), tgt_row.to_dict()))
                used_target_indices.add(best_pos)
        else:
            remaining_source.append(src_row)

    matched_df = pd.DataFrame(matched_rows)
    still_unmatched_source = (
        pd.DataFrame(remaining_source, columns=unmatched_source.columns)
        if remaining_source
        else pd.DataFrame(columns=unmatched_source.columns)
    )
    still_unmatched_target = tgt[~tgt.index.isin(used_target_indices)].drop(columns=["_date_pd"], errors="ignore")

    return matched_df, still_unmatched_source, still_unmatched_target, ambiguous_pairs
