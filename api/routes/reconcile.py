"""
POST /reconcile

Accepts two uploaded files + column mappings, runs the full reconciliation
pipeline, persists the result to Supabase, and returns the result.

Multi-tenancy: every DB write is scoped to the org_id from the Clerk JWT.
"""

import io
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel

from api.auth import CurrentUser, get_current_user, CurrentIdentity, get_api_identity, RequiresScope
from api.db import get_db
from api.quota import check_and_increment_quota
from core.ai_resolver import resolve_all
from core.column_mapper import apply_mapping
from core.file_reader import read_file
from core.matcher import exact_match, fuzzy_match

router = APIRouter()


# ---------------------------------------------------------------------------
# Request / response models
# ---------------------------------------------------------------------------

class DuplicateGroup(BaseModel):
    amount: float
    party: str
    date: str
    occurrences: int
    row_ids: list[str]

class DuplicateReport(BaseModel):
    source: list[DuplicateGroup]
    target: list[DuplicateGroup]
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
    completed_at: str | None = None

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

class BatchRunResult(BaseModel):
    source_filename: str
    target_filename: str
    status: str
    error: str | None = None
    result: ReconcileResult | None = None

class BatchReconcileResult(BaseModel):
    summary: BatchSummary
    runs: list[BatchRunResult]


# ---------------------------------------------------------------------------
# Helper: ensure the org exists in our DB (first-time users)
# ---------------------------------------------------------------------------

def _ensure_org(db, user: CurrentIdentity) -> str:
    """
    Create the org + member records if this is the first time we see this
    Clerk organization.  Returns the internal org UUID.
    """
    # Fallback to a personal org if the user isn't in a Clerk Organization
    effective_org_id = user.org_id or f"personal_{user.clerk_user_id}"

    # Check if org exists
    result = (
        db.table("organizations")
        .select("id")
        .eq("clerk_org_id", effective_org_id)
        .maybe_single()
        .execute()
    )

    if result and getattr(result, "data", None):
        org_uuid = result.data["id"]
    else:
        # First time this org is seen — create it
        new_org = (
            db.table("organizations")
            .insert({"clerk_org_id": effective_org_id, "name": "Personal Workspace" if not user.org_id else user.org_id})
            .execute()
        )
        org_uuid = new_org.data[0]["id"] if new_org and getattr(new_org, "data", None) else None
        
        if not org_uuid:
            raise HTTPException(status_code=500, detail="Failed to create organization.")

    # Ensure this user is in the members table
    db.table("organization_members").upsert(
        {
            "org_id":        org_uuid,
            "clerk_user_id": user.clerk_user_id,
            "role":          user.org_role or "member",
        },
        on_conflict="org_id,clerk_user_id",
    ).execute()

    return org_uuid


# ---------------------------------------------------------------------------
# POST /reconcile
# ---------------------------------------------------------------------------

@router.post("/", response_model=ReconcileResult)
async def reconcile(
    source_file: UploadFile   = File(...,  description="Source CSV/XLSX (e.g. gateway export)"),
    target_file: UploadFile   = File(...,  description="Target CSV/XLSX (e.g. bank statement)"),

    # Column mappings — sent as JSON strings in form fields
    source_mapping_json: str  = Form(...),
    target_mapping_json: str  = Form(...),
    source_amount_mode: str   = Form("single"),
    target_amount_mode: str   = Form("single"),
    amount_tolerance: float   = Form(20.0, ge=0.0),
    date_window_days: int     = Form(5, ge=0, le=60),

    user: CurrentIdentity = Depends(get_api_identity),
):
    """
    Run full reconciliation pipeline:
      1. Parse both files
      2. Apply column mappings
      3. Exact match → fuzzy match → AI resolve ambiguous
      4. Persist result to Supabase
      5. Return full result including exception report
    """
    import json

    db     = get_db()
    org_id = _ensure_org(db, user)
    run_id = str(uuid.uuid4())

    # Create a "processing" run record immediately so the frontend can poll
    db.table("recon_runs").insert({
        "id":              run_id,
        "org_id":          org_id,
        "clerk_user_id":   user.clerk_user_id,
        "status":          "processing",
        "source_filename": source_file.filename,
        "target_filename": target_file.filename,
    }).execute()

    try:
        source_mapping = json.loads(source_mapping_json)
        target_mapping = json.loads(target_mapping_json)

        # --- Parse files ---
        src_bytes = await source_file.read()
        tgt_bytes = await target_file.read()
        
        src_io = io.BytesIO(src_bytes)
        src_io.name = source_file.filename
        
        tgt_io = io.BytesIO(tgt_bytes)
        tgt_io.name = target_file.filename
        
        src_raw = read_file(src_io)
        tgt_raw = read_file(tgt_io)

        # --- Apply mappings ---
        src_df, src_bad = apply_mapping(src_raw, source_mapping, amount_mode=source_amount_mode)
        tgt_df, tgt_bad = apply_mapping(tgt_raw, target_mapping, amount_mode=target_amount_mode)

        from core.reconciliation_service import reconcile_pair
        ai_config = _load_org_ai_config(db, org_id)
        
        pair_result = reconcile_pair(
            src_df=src_df,
            tgt_df=tgt_df,
            source_filename=source_file.filename,
            target_filename=target_file.filename,
            amount_tolerance=amount_tolerance,
            date_window_days=date_window_days,
            ai_config=ai_config
        )
        
        total_source = pair_result["total_source_rows"]
        total_matched = pair_result["total_matched"]
        match_rate = pair_result["match_rate"]
        exact_m_len = pair_result["exact_matches"]
        fuzzy_m_len = pair_result["fuzzy_matches"]
        ai_confirmed_len = pair_result["ai_matches"]
        exceptions = pair_result["exception_report"]
        duplicate_report = DuplicateReport(**pair_result["duplicates"])
        dashboard_summary = DashboardSummary(**pair_result["summary"])

        # --- Update run record with results ---
        db.table("recon_runs").update({
            "status":             "completed",
            "total_source_rows":  total_source,
            "total_matched":      total_matched,
            "match_rate":         match_rate,
            "exact_matches":      exact_m_len,
            "fuzzy_matches":      fuzzy_m_len,
            "ai_matches":         ai_confirmed_len,
            "exceptions_count":   len(exceptions),
            "exception_report":   exceptions,
            "amount_tolerance":   amount_tolerance,
            "date_window_days":   date_window_days,
            "duplicates":         pair_result["duplicates"],
            "summary":            pair_result["summary"],
            "ai_provider":        ai_config.get("provider", "none"),
            "completed_at":       datetime.now(timezone.utc).isoformat(),
        }).eq("id", run_id).execute()

        ts = datetime.now(timezone.utc).isoformat()
        return ReconcileResult(
            run_id=run_id,
            status="completed",
            total_source_rows=total_source,
            total_matched=total_matched,
            match_rate=match_rate,
            exact_matches=exact_m_len,
            fuzzy_matches=fuzzy_m_len,
            ai_matches=ai_confirmed_len,
            exceptions_count=len(exceptions),
            exception_report=exceptions,
            ai_provider=ai_config.get("provider", "none"),
            amount_tolerance=amount_tolerance,
            date_window_days=date_window_days,
            duplicates=duplicate_report,
            summary=dashboard_summary,
            completed_at=ts,
        )

    except Exception as e:
        # Mark the run as failed — never leave it stuck in "processing"
        db.table("recon_runs").update({
            "status":        "failed",
            "error_message": str(e),
            "completed_at":  datetime.now(timezone.utc).isoformat(),
        }).eq("id", run_id).execute()
        raise HTTPException(status_code=500, detail=str(e))


def _load_org_ai_config(db, org_id: str) -> dict:
    """Load and decrypt the organization's saved AI config. Falls back to none."""
    from api.crypto import decrypt
    from core.ai_resolver import PROVIDERS

    result = (
        db.table("org_ai_config")
        .select("*")
        .eq("org_id", org_id)
        .maybe_single()
        .execute()
    )

    if not result or not getattr(result, "data", None):
        return {"provider": "none"}

    row      = result.data
    provider = row.get("provider", "none")
    meta     = PROVIDERS.get(provider, {})

    api_key = ""
    if row.get("encrypted_api_key"):
        try:
            api_key = decrypt(row["encrypted_api_key"])
        except Exception:
            api_key = ""

    return {
        "provider": provider,
        "api_key":  api_key,
        "model":    row.get("model_override") or meta.get("model", ""),
        "base_url": row.get("base_url_override") or meta.get("base_url"),
    }

# ---------------------------------------------------------------------------
# POST /reconcile/batch
# ---------------------------------------------------------------------------

@router.post("/batch", response_model=BatchReconcileResult)
async def reconcile_batch(
    source_files: list[UploadFile] = File(..., description="Source CSVs"),
    target_files: list[UploadFile] = File(..., description="Target CSVs"),

    source_mapping_json: str  = Form(...),
    target_mapping_json: str  = Form(...),
    source_amount_mode: str   = Form("single"),
    target_amount_mode: str   = Form("single"),
    amount_tolerance: float   = Form(20.0, ge=0.0),
    date_window_days: int     = Form(5, ge=0, le=60),

    user: CurrentIdentity = Depends(RequiresScope("reconcile")),
):
    import json
    
    if len(source_files) != len(target_files):
        raise HTTPException(status_code=400, detail="Mismatched number of source and target files.")
    if len(source_files) > 20:
        raise HTTPException(status_code=400, detail="Maximum 20 pairs allowed per batch.")
    if len(source_files) == 0:
        raise HTTPException(status_code=400, detail="No files provided.")

    db     = get_db()
    org_id = _ensure_org(db, user)

    # Quota check (fails entirely if quota exceeded before starting)
    check_and_increment_quota(org_id, user.plan, len(source_files))
    
    source_mapping = json.loads(source_mapping_json)
    target_mapping = json.loads(target_mapping_json)
    ai_config = _load_org_ai_config(db, org_id)
    
    from core.reconciliation_service import reconcile_pair
    
    batch_id = str(uuid.uuid4())
    # Create the batch record immediately (processing state)
    db.table("recon_batches").insert({
        "id":            batch_id,
        "org_id":        org_id,
        "clerk_user_id": user.clerk_user_id,
        "status":        "processing",
    }).execute()

    runs = []
    
    for src_file, tgt_file in zip(source_files, target_files):
        run_id = str(uuid.uuid4())
        # Insert initial processing state
        db.table("recon_runs").insert({
            "id":              run_id,
            "org_id":          org_id,
            "batch_id":        batch_id,
            "clerk_user_id":   user.clerk_user_id,
            "status":          "processing",
            "source_filename": src_file.filename,
            "target_filename": tgt_file.filename,
        }).execute()
        
        try:
            src_bytes = await src_file.read()
            tgt_bytes = await tgt_file.read()
            
            src_io = io.BytesIO(src_bytes)
            src_io.name = src_file.filename
            tgt_io = io.BytesIO(tgt_bytes)
            tgt_io.name = tgt_file.filename
            
            src_raw = read_file(src_io)
            tgt_raw = read_file(tgt_io)
            
            # Apply mappings
            src_df, _ = apply_mapping(src_raw, source_mapping, amount_mode=source_amount_mode)
            tgt_df, _ = apply_mapping(tgt_raw, target_mapping, amount_mode=target_amount_mode)
            
            pair_result = reconcile_pair(
                src_df=src_df,
                tgt_df=tgt_df,
                source_filename=src_file.filename,
                target_filename=tgt_file.filename,
                amount_tolerance=amount_tolerance,
                date_window_days=date_window_days,
                ai_config=ai_config
            )
            
            # Update DB with result
            db.table("recon_runs").update({
                "status":             "completed",
                "total_source_rows":  pair_result["total_source_rows"],
                "total_matched":      pair_result["total_matched"],
                "match_rate":         pair_result["match_rate"],
                "exact_matches":      pair_result["exact_matches"],
                "fuzzy_matches":      pair_result["fuzzy_matches"],
                "ai_matches":         pair_result["ai_matches"],
                "exceptions_count":   pair_result["exceptions_count"],
                "exception_report":   pair_result["exception_report"],
                "amount_tolerance":   amount_tolerance,
                "date_window_days":   date_window_days,
                "duplicates":         pair_result["duplicates"],
                "summary":            pair_result["summary"],
                "ai_provider":        ai_config.get("provider", "none"),
                "completed_at":       datetime.now(timezone.utc).isoformat(),
            }).eq("id", run_id).execute()
            
            run_ts = datetime.now(timezone.utc).isoformat()
            result = ReconcileResult(
                run_id=run_id,
                status="completed",
                total_source_rows=pair_result["total_source_rows"],
                total_matched=pair_result["total_matched"],
                match_rate=pair_result["match_rate"],
                exact_matches=pair_result["exact_matches"],
                fuzzy_matches=pair_result["fuzzy_matches"],
                ai_matches=pair_result["ai_matches"],
                exceptions_count=pair_result["exceptions_count"],
                exception_report=pair_result["exception_report"],
                ai_provider=ai_config.get("provider", "none"),
                amount_tolerance=amount_tolerance,
                date_window_days=date_window_days,
                duplicates=DuplicateReport(**pair_result["duplicates"]),
                summary=DashboardSummary(**pair_result["summary"]),
                completed_at=run_ts,
            )
            runs.append(BatchRunResult(
                source_filename=src_file.filename,
                target_filename=tgt_file.filename,
                status="completed",
                result=result
            ))
        except Exception as e:
            # Mark as failed in DB
            db.table("recon_runs").update({
                "status":        "failed",
                "error_message": str(e),
                "completed_at":  datetime.now(timezone.utc).isoformat(),
            }).eq("id", run_id).execute()
            runs.append(BatchRunResult(
                source_filename=src_file.filename,
                target_filename=tgt_file.filename,
                status="failed",
                error=str(e)
            ))
            
    # Aggregate summary
    total_transactions = sum(r.result.total_source_rows for r in runs if r.status == "completed" and r.result)
    total_matched = sum(r.result.total_matched for r in runs if r.status == "completed" and r.result)
    total_exceptions = sum(r.result.exceptions_count for r in runs if r.status == "completed" and r.result)
    overall_match_rate = min(100.0, round(100 * total_matched / total_transactions, 2)) if total_transactions else 0.0
    
    total_amount = sum(r.result.summary.total_amount for r in runs if r.status == "completed" and r.result)
    total_matched_amount = sum(r.result.summary.matched_amount for r in runs if r.status == "completed" and r.result)
    total_unmatched_amount = sum(r.result.summary.unmatched_amount for r in runs if r.status == "completed" and r.result)
    
    dup_source = sum(r.result.duplicates.source_count for r in runs if r.status == "completed" and r.result)
    dup_target = sum(r.result.duplicates.target_count for r in runs if r.status == "completed" and r.result)
    
    summary = BatchSummary(
        total_transactions=total_transactions,
        total_matched=total_matched,
        total_exceptions=total_exceptions,
        overall_match_rate=overall_match_rate,
        total_amount=total_amount,
        total_matched_amount=total_matched_amount,
        total_unmatched_amount=total_unmatched_amount,
        duplicate_source_groups=dup_source,
        duplicate_target_groups=dup_target,
        completed_runs=sum(1 for r in runs if r.status == "completed"),
        failed_runs=sum(1 for r in runs if r.status == "failed")
    )
    
    # Mark batch as completed
    db.table("recon_batches").update({
        "status":       "completed",
        "summary":      summary.model_dump(),
        "completed_at": datetime.now(timezone.utc).isoformat(),
    }).eq("id", batch_id).execute()
    
    return BatchReconcileResult(summary=summary, runs=runs)
