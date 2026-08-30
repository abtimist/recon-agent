"""GET /runs — reconciliation history per organization."""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional

from api.auth import CurrentIdentity, get_api_identity, RequiresScope
from api.db import get_db
from api.routes.reconcile import _ensure_org

router = APIRouter()

class DuplicateReport(BaseModel):
    source: list[dict]
    target: list[dict]
    source_count: int
    target_count: int

class DashboardSummary(BaseModel):
    total_amount: float
    matched_amount: float
    unmatched_amount: float
    top_exception_merchants: list[dict]
    exceptions_by_date: list[dict]

class ReconcileResult(BaseModel):
    run_id: str
    status: str
    total_source_rows: int
    total_matched: int
    match_rate: float
    exact_matches: int
    fuzzy_matches: int
    ai_matches: int
    exceptions_count: int
    exception_report: list[dict]
    ai_provider: str
    amount_tolerance: float
    date_window_days: int
    duplicates: DuplicateReport
    summary: DashboardSummary
    completed_at: Optional[str] = None

class BatchRunResult(BaseModel):
    source_filename: str
    target_filename: str
    status: str
    result: Optional[ReconcileResult] = None
    error: Optional[str] = None

class BatchSummary(BaseModel):
    total_transactions: int
    total_matched: int
    total_exceptions: int
    overall_match_rate: float
    total_amount: float
    total_matched_amount: float
    total_unmatched_amount: float
    duplicate_source_groups: int
    duplicate_target_groups: int
    completed_runs: int
    failed_runs: int

class BatchReconcileResult(BaseModel):
    summary: BatchSummary
    runs: list[BatchRunResult]

class RunSummary(BaseModel):
    id: str
    is_batch: bool
    status: str
    source_filename: Optional[str] = None
    target_filename: Optional[str] = None
    total_source_rows: Optional[int] = None
    total_matched: Optional[int] = None
    match_rate: Optional[float] = None
    exceptions_count: Optional[int] = None
    ai_provider: Optional[str] = None
    created_at: str
    completed_at: Optional[str] = None
    # For batch summaries
    completed_runs: Optional[int] = None
    failed_runs: Optional[int] = None
    total_transactions: Optional[int] = None


@router.get("/", response_model=list[RunSummary])
def list_runs(
    limit: int = 20,
    offset: int = 0,
    user: CurrentIdentity = Depends(RequiresScope("history")),
):
    """Return the most recent reconciliation runs (single and batch)."""
    db     = get_db()
    org_id = _ensure_org(db, user)

    # Fetch single runs
    single_res = (
        db.table("recon_runs")
        .select(
            "id, status, source_filename, target_filename, "
            "total_source_rows, total_matched, match_rate, "
            "exceptions_count, ai_provider, created_at, completed_at"
        )
        .eq("org_id", org_id)
        .is_("batch_id", "null")
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
    )
    
    # Fetch batch runs
    batch_res = (
        db.table("recon_batches")
        .select("id, status, summary, created_at, completed_at")
        .eq("org_id", org_id)
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
    )

    combined = []
    for r in (single_res.data or []):
        combined.append(RunSummary(
            id=r["id"],
            is_batch=False,
            status=r["status"],
            source_filename=r["source_filename"],
            target_filename=r["target_filename"],
            total_source_rows=r["total_source_rows"],
            total_matched=r["total_matched"],
            match_rate=r["match_rate"],
            exceptions_count=r["exceptions_count"],
            ai_provider=r["ai_provider"],
            created_at=r["created_at"],
            completed_at=r["completed_at"],
        ))
        
    for b in (batch_res.data or []):
        s = b.get("summary") or {}
        combined.append(RunSummary(
            id=b["id"],
            is_batch=True,
            status=b["status"],
            created_at=b["created_at"],
            completed_at=b["completed_at"],
            total_transactions=s.get("total_transactions"),
            total_matched=s.get("total_matched"),
            match_rate=s.get("overall_match_rate"),
            exceptions_count=s.get("total_exceptions"),
            completed_runs=s.get("completed_runs"),
            failed_runs=s.get("failed_runs"),
        ))

    # Sort combined by created_at desc
    combined.sort(key=lambda x: x.created_at, reverse=True)
    
    return combined[offset:offset+limit]

@router.delete("/")
def clear_history(
    user: CurrentIdentity = Depends(RequiresScope("history")),
):
    """Clear all reconciliation history for the user's organization."""
    db     = get_db()
    org_id = _ensure_org(db, user)

    db.table("recon_runs").delete().eq("org_id", org_id).execute()
    db.table("recon_batches").delete().eq("org_id", org_id).execute()

    return {"status": "ok", "message": "History cleared"}

@router.get("/stats")
def get_dashboard_stats(
    user: CurrentIdentity = Depends(RequiresScope("history")),
):
    """Aggregated stats for the dashboard."""
    db     = get_db()
    org_id = _ensure_org(db, user)

    # Fetch all runs for aggregation (for MVP we fetch all, can optimize later)
    res = (
        db.table("recon_runs")
        .select("status, match_rate, exceptions_count, ai_matches, summary")
        .eq("org_id", org_id)
        .is_("batch_id", "null")
        .execute()
    )
    runs = res.data or []

    total_runs = len(runs)
    total_exceptions = sum(r.get("exceptions_count") or 0 for r in runs)
    total_ai_resolutions = sum(r.get("ai_matches") or 0 for r in runs)
    
    valid_rates = [r.get("match_rate") for r in runs if r.get("match_rate") is not None]
    avg_match_rate = sum(valid_rates) / len(valid_rates) if valid_rates else 0.0

    total_amount = 0.0
    matched_amount = 0.0
    for r in runs:
        summary = r.get("summary") or {}
        total_amount += float(summary.get("total_amount") or 0)
        matched_amount += float(summary.get("matched_amount") or 0)

    return {
        "totalRuns": total_runs,
        "avgMatchRate": avg_match_rate,
        "totalExceptions": total_exceptions,
        "aiResolutions": total_ai_resolutions,
        "totalAmount": total_amount,
        "matchedAmount": matched_amount
    }

@router.get("/batch/{batch_id}/status")
def get_batch_status(
    batch_id: str,
    user: CurrentIdentity = Depends(RequiresScope("history")),
):
    """Return just the status of a batch."""
    db     = get_db()
    org_id = _ensure_org(db, user)

    result = (
        db.table("recon_batches")
        .select("status")
        .eq("id", batch_id)
        .eq("org_id", org_id)
        .maybe_single()
        .execute()
    )

    if not result or not getattr(result, "data", None):
        raise HTTPException(status_code=404, detail="Batch not found.")
        
    return result.data

@router.get("/batch/{batch_id}", response_model=BatchReconcileResult)
def get_batch(
    batch_id: str,
    user: CurrentIdentity = Depends(RequiresScope("history")),
):
    """Return full detail for a batch run."""
    db     = get_db()
    org_id = _ensure_org(db, user)

    b_res = (
        db.table("recon_batches")
        .select("*")
        .eq("id", batch_id)
        .eq("org_id", org_id)
        .maybe_single()
        .execute()
    )
    if not b_res or not getattr(b_res, "data", None):
        raise HTTPException(status_code=404, detail="Batch not found.")
        
    batch_data = b_res.data
    
    # Fetch all sub-runs
    runs_res = (
        db.table("recon_runs")
        .select("*")
        .eq("batch_id", batch_id)
        .eq("org_id", org_id)
        .execute()
    )
    
    batch_runs = []
    for r in (runs_res.data or []):
        if r["status"] == "completed":
            res = ReconcileResult(
                run_id=r["id"],
                status=r["status"],
                total_source_rows=(r.get("total_source_rows") or 0),
                total_matched=(r.get("total_matched") or 0),
                match_rate=(r.get("match_rate") or 0.0),
                exact_matches=(r.get("exact_matches") or 0),
                fuzzy_matches=(r.get("fuzzy_matches") or 0),
                ai_matches=(r.get("ai_matches") or 0),
                exceptions_count=(r.get("exceptions_count") or 0),
                exception_report=(r.get("exception_report") or []),
                ai_provider=(r.get("ai_provider") or "none"),
                amount_tolerance=(r.get("amount_tolerance") or 20.0),
                date_window_days=(r.get("date_window_days") or 5),
                duplicates=DuplicateReport(**(r.get("duplicates") or {"source":[], "target":[], "source_count":0, "target_count":0})),
                summary=DashboardSummary(**(r.get("summary") or {"total_amount":0, "matched_amount":0, "unmatched_amount":0, "top_exception_merchants":[], "exceptions_by_date":[]})),
                completed_at=r["completed_at"],
            )
            batch_runs.append(BatchRunResult(
                source_filename=r["source_filename"],
                target_filename=r["target_filename"],
                status=r["status"],
                result=res
            ))
        else:
            batch_runs.append(BatchRunResult(
                source_filename=r["source_filename"],
                target_filename=r["target_filename"],
                status=r["status"],
                error=r.get("error_message")
            ))
            
    summary_data = batch_data.get("summary", {})
    # Provide safe defaults if the summary is missing or empty
    summary = BatchSummary(
        total_transactions=summary_data.get("total_transactions", 0),
        total_matched=summary_data.get("total_matched", 0),
        total_exceptions=summary_data.get("total_exceptions", 0),
        overall_match_rate=summary_data.get("overall_match_rate", 0.0),
        total_amount=summary_data.get("total_amount", 0.0),
        total_matched_amount=summary_data.get("total_matched_amount", 0.0),
        total_unmatched_amount=summary_data.get("total_unmatched_amount", 0.0),
        duplicate_source_groups=summary_data.get("duplicate_source_groups", 0),
        duplicate_target_groups=summary_data.get("duplicate_target_groups", 0),
        completed_runs=summary_data.get("completed_runs", 0),
        failed_runs=summary_data.get("failed_runs", 0),
    )
    
    return BatchReconcileResult(summary=summary, runs=batch_runs)


@router.get("/{run_id}", response_model=ReconcileResult)
def get_run(
    run_id: str,
    user: CurrentIdentity = Depends(RequiresScope("history")),
):
    """Return full detail + exception report for a single run."""
    db     = get_db()
    org_id = _ensure_org(db, user)

    result = (
        db.table("recon_runs")
        .select("*")
        .eq("id", run_id)
        .eq("org_id", org_id)   # enforces org isolation
        .maybe_single()
        .execute()
    )

    if not result or not getattr(result, "data", None):
        raise HTTPException(status_code=404, detail="Run not found.")
        
    r = result.data
    return ReconcileResult(
        run_id=r["id"],
        status=r["status"],
        total_source_rows=(r.get("total_source_rows") or 0),
        total_matched=(r.get("total_matched") or 0),
        match_rate=(r.get("match_rate") or 0.0),
        exact_matches=(r.get("exact_matches") or 0),
        fuzzy_matches=(r.get("fuzzy_matches") or 0),
        ai_matches=(r.get("ai_matches") or 0),
        exceptions_count=(r.get("exceptions_count") or 0),
        exception_report=(r.get("exception_report") or []),
        ai_provider=(r.get("ai_provider") or "none"),
        amount_tolerance=(r.get("amount_tolerance") or 20.0),
        date_window_days=(r.get("date_window_days") or 5),
        duplicates=DuplicateReport(**(r.get("duplicates") or {"source":[], "target":[], "source_count":0, "target_count":0})),
        summary=DashboardSummary(**(r.get("summary") or {"total_amount":0, "matched_amount":0, "unmatched_amount":0, "top_exception_merchants":[], "exceptions_by_date":[]})),
        completed_at=r.get("completed_at"),
    )


@router.get("/{run_id}/status")
def get_run_status(
    run_id: str,
    user: CurrentIdentity = Depends(RequiresScope("history")),
):
    """Return just the status of a run."""
    db     = get_db()
    org_id = _ensure_org(db, user)

    result = (
        db.table("recon_runs")
        .select("status, error_message")
        .eq("id", run_id)
        .eq("org_id", org_id)
        .maybe_single()
        .execute()
    )

    if not result or not getattr(result, "data", None):
        raise HTTPException(status_code=404, detail="Run not found.")
        
    return result.data

@router.get("/{run_id}/exceptions/download")
def download_exceptions(
    run_id: str,
    user: CurrentIdentity = Depends(RequiresScope("history")),
):
    """Stream the exception report as a CSV download."""
    import io
    import pandas as pd
    from fastapi.responses import StreamingResponse

    db     = get_db()
    org_id = _ensure_org(db, user)

    result = (
        db.table("recon_runs")
        .select("exception_report, source_filename")
        .eq("id", run_id)
        .eq("org_id", org_id)
        .maybe_single()
        .execute()
    )

    if not result or not getattr(result, "data", None) or not result.data.get("exception_report"):
        raise HTTPException(status_code=404, detail="No exception report found for this run.")

    df       = pd.DataFrame(result.data["exception_report"])
    buf      = io.StringIO()
    df.to_csv(buf, index=False)
    buf.seek(0)

    filename = f"exceptions_{run_id[:8]}.csv"
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )
