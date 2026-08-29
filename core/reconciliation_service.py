import pandas as pd
from datetime import datetime, timezone
from collections import defaultdict

from core.duplicate_detector import detect_duplicates
from core.matcher import exact_match, fuzzy_match
from core.ai_resolver import resolve_all

def reconcile_pair(
    src_df: pd.DataFrame,
    tgt_df: pd.DataFrame,
    source_filename: str,
    target_filename: str,
    amount_tolerance: float,
    date_window_days: int,
    ai_config: dict
) -> dict:
    """
    Core reconciliation execution flow.
    Applies duplicate detection, matching (exact, fuzzy, AI), exceptions, and summary logic.
    Returns a dictionary of result fields.
    """
    # --- Duplicate Detection ---
    source_duplicates = detect_duplicates(src_df)
    target_duplicates = detect_duplicates(tgt_df)
    
    duplicate_report = {
        "source": source_duplicates,
        "target": target_duplicates,
        "source_count": len(source_duplicates),
        "target_count": len(target_duplicates)
    }

    total_source = len(src_df)

    # --- Matching ---
    exact_m, unmatched_src, unmatched_tgt = exact_match(src_df, tgt_df)
    fuzzy_m, still_src, still_tgt, ambiguous = fuzzy_match(
        unmatched_src, 
        unmatched_tgt,
        amount_tolerance=amount_tolerance,
        date_window_days=date_window_days
    )

    # --- AI resolver ---
    ai_results = resolve_all(ambiguous, ai_config=ai_config) if ambiguous else []

    ai_confirmed = [r for r in ai_results if r["decision"]["is_match"]]
    ai_rejected  = [r for r in ai_results if not r["decision"]["is_match"]]

    total_matched = len(exact_m) + len(fuzzy_m) + len(ai_confirmed)
    match_rate    = min(100.0, round(100 * total_matched / total_source, 2)) if total_source else 0.0

    # --- Build exception report ---
    exceptions = []
    for _, row in still_src.iterrows():
        exceptions.append({
            "type":   "missing_target_record",
            "id":     row["id"],
            "party":  row.get("party", ""),
            "amount": float(row["amount"]),
            "reason": "No plausible match found within tolerance/date window",
            "date":   str(row.get("date", ""))
        })
    for r in ai_rejected:
        exceptions.append({
            "type":   "ai_rejected_ambiguous_match",
            "id":     r["source_row"]["id"],
            "party":  r["source_row"].get("party", ""),
            "amount": float(r["source_row"]["amount"]),
            "reason": r["decision"]["reason"],
            "date":   str(r["source_row"].get("date", ""))
        })
    for _, row in still_tgt.iterrows():
        exceptions.append({
            "type":   "stray_target_record",
            "id":     row["id"],
            "party":  row.get("party", ""),
            "amount": float(row["amount"]),
            "reason": "Target record with no corresponding source record",
            "date":   str(row.get("date", ""))
        })

    # --- Calculate Dashboard Summary ---
    total_amount = float(src_df["amount"].sum()) if "amount" in src_df.columns and not src_df.empty else 0.0
    matched_amount = float(
        (exact_m["amount_source"].sum() if not exact_m.empty else 0.0) +
        (fuzzy_m["amount_source"].sum() if not fuzzy_m.empty else 0.0) +
        sum(float(r["source_row"]["amount"]) for r in ai_confirmed)
    )
    unmatched_amount = float(sum(abs(e["amount"]) for e in exceptions))
    
    merchant_counts = defaultdict(int)
    for e in exceptions:
        if e.get("party") and str(e["party"]).strip():
            merchant_counts[str(e["party"]).strip()] += 1
    
    top_exception_merchants = [
        {"party": k, "count": v}
        for k, v in sorted(merchant_counts.items(), key=lambda x: x[1], reverse=True)[:5]
    ]
    
    date_counts = defaultdict(int)
    for e in exceptions:
        if e.get("date") and str(e["date"]).strip():
            date_counts[str(e["date"]).strip()] += 1
            
    exceptions_by_date = []
    if len(date_counts) > 1:
        exceptions_by_date = [
            {"date": k, "count": v}
            for k, v in sorted(date_counts.items())
        ]

    dashboard_summary = {
        "total_amount": total_amount,
        "matched_amount": matched_amount,
        "unmatched_amount": unmatched_amount,
        "top_exception_merchants": top_exception_merchants,
        "exceptions_by_date": exceptions_by_date
    }

    return {
        "total_source_rows": total_source,
        "total_matched": total_matched,
        "match_rate": match_rate,
        "exact_matches": len(exact_m),
        "fuzzy_matches": len(fuzzy_m),
        "ai_matches": len(ai_confirmed),
        "exceptions_count": len(exceptions),
        "exception_report": exceptions,
        "duplicates": duplicate_report,
        "summary": dashboard_summary,
        "amount_tolerance": amount_tolerance,
        "date_window_days": date_window_days,
        "source_filename": source_filename,
        "target_filename": target_filename,
    }
