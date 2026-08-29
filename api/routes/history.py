"""GET /runs — reconciliation history per organization."""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional

from api.auth import CurrentUser, get_current_user, CurrentIdentity, get_api_identity
from api.db import get_db
from api.routes.reconcile import _ensure_org

from api.routes.reconcile import _ensure_org, ReconcileResult, BatchReconcileResult, BatchRunResult, BatchSummary, DuplicateReport, DashboardSummary

router = APIRouter()

class RunSummary(BaseModel):
    id: str
    is_batch: bool
    status: str
    source_filename: Optional[str]
    target_filename: Optional[str]
    total_source_rows: Optional[int]
    total_matched: Optional[int]
    match_rate: Optional[float]
    exceptions_count: Optional[int]
    ai_provider: Optional[str]
    created_at: str
    completed_at: Optional[str]
    # For batch summaries
    completed_runs: Optional[int] = None
    failed_runs: Optional[int] = None
    total_transactions: Optional[int] = None


@router.get("/", response_model=list[RunSummary])
def list_runs(
    limit: int = 20,
    offset: int = 0,
    user: CurrentIdentity = Depends(get_api_identity),
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
        s = b.get("summary", {})
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


@router.get("/batch/{batch_id}", response_model=BatchReconcileResult)
def get_batch(
    batch_id: str,
    user: CurrentIdentity = Depends(get_api_identity),
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
    user: CurrentIdentity = Depends(get_api_identity),
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


@router.get("/{run_id}/exceptions/download")
def download_exceptions(
    run_id: str,
    user: CurrentIdentity = Depends(get_api_identity),
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
