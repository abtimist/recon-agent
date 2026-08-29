from api.db import get_db
from api.routes.history import get_run

db = get_db()
r = db.table("recon_runs").select("*").eq("id", "05ce7432-0657-4ad0-ad3e-d6dbc5732967").execute()
r_data = r.data[0]

from api.routes.reconcile import DuplicateReport, DashboardSummary, ReconcileResult

print(r_data.get("duplicates"))
print(r_data.get("summary"))

try:
    duplicates = DuplicateReport(**(r_data.get("duplicates") or {"source":[], "target":[], "source_count":0, "target_count":0}))
    print("duplicates OK")
    summary = DashboardSummary(**(r_data.get("summary") or {"total_amount":0, "matched_amount":0, "unmatched_amount":0, "top_exception_merchants":[], "exceptions_by_date":[]}))
    print("summary OK")
    
    # Check what else might be failing
    res = ReconcileResult(
        run_id=r_data["id"],
        status=r_data["status"],
        total_source_rows=r_data.get("total_source_rows", 0),
        total_matched=r_data.get("total_matched", 0),
        match_rate=r_data.get("match_rate", 0.0),
        exact_matches=r_data.get("exact_matches", 0),
        fuzzy_matches=r_data.get("fuzzy_matches", 0),
        ai_matches=r_data.get("ai_matches", 0),
        exceptions_count=r_data.get("exceptions_count", 0),
        exception_report=r_data.get("exception_report") or [],
        ai_provider=r_data.get("ai_provider", "none"),
        amount_tolerance=r_data.get("amount_tolerance", 20.0),
        date_window_days=r_data.get("date_window_days", 5),
        duplicates=duplicates,
        summary=summary,
        completed_at=r_data.get("completed_at"),
    )
    print("ReconcileResult OK")
except Exception as e:
    import traceback
    traceback.print_exc()

