import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from typing import Any

from api.auth import CurrentIdentity, get_api_identity, RequiresScope, RequiresTier
from api.db import get_db
from api.routes.reconcile import _ensure_org

router = APIRouter()

class ExplainRequest(BaseModel):
    type: str  # "single" or "batch"
    result: Any # dict of ReconcileResult or BatchReconcileResult

class ExplainJobAccepted(BaseModel):
    job_id: str
    status: str
    message: str

@router.post("/", response_model=ExplainJobAccepted, status_code=status.HTTP_202_ACCEPTED)
def explain_result(
    request: ExplainRequest,
    user: CurrentIdentity = Depends(RequiresScope("explain")),
    _tier: CurrentIdentity = Depends(RequiresTier("pro")),
):
    """
    Queue an AI-powered CFO Explanation for a reconciliation result.
    Returns 202 Accepted and a job_id.
    """
    db = get_db()
    org_id = _ensure_org(db, user)

    # Preflight check if AI is configured
    ai_config_res = db.table("org_ai_config").select("provider").eq("org_id", org_id).maybe_single().execute()
    provider = "none"
    if ai_config_res and getattr(ai_config_res, "data", None):
        provider = ai_config_res.data.get("provider", "none")    
    if provider == "none":
        raise HTTPException(
            status_code=400,
            detail="AI Explanation unavailable — configure an AI provider in Settings."
        )
        
    if request.type not in ("single", "batch"):
        raise HTTPException(status_code=400, detail="Invalid explanation type. Must be 'single' or 'batch'.")

    job_id = str(uuid.uuid4())

    try:
        db.table("explain_jobs").insert({
            "id": job_id,
            "org_id": org_id,
            "clerk_user_id": user.clerk_user_id,
            "job_type": request.type,
            "status": "queued",
            "request_data": request.model_dump()["result"]
        }).execute()

        return ExplainJobAccepted(
            job_id=job_id,
            status="queued",
            message="Explain job queued successfully."
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{job_id}/status")
def get_explain_status(
    job_id: str,
    user: CurrentIdentity = Depends(RequiresScope("explain")),
):
    """
    Poll the status of an explain job.
    """
    db = get_db()
    org_id = _ensure_org(db, user)

    res = db.table("explain_jobs").select("*").eq("id", job_id).eq("org_id", org_id).maybe_single().execute()
    
    if not res or not res.data:
        raise HTTPException(status_code=404, detail="Job not found")
        
    return res.data

@router.get("/run/{run_id}")
def get_explain_by_run(
    run_id: str,
    user: CurrentIdentity = Depends(RequiresScope("explain")),
):
    """
    Fetch the latest completed explanation for a specific run ID.
    """
    db = get_db()
    org_id = _ensure_org(db, user)

    res = (
        db.table("explain_jobs")
        .select("response_data")
        .eq("org_id", org_id)
        .eq("status", "completed")
        .eq("request_data->>run_id", run_id)
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )
    
    if not res or not res.data or not res.data[0].get("response_data"):
        raise HTTPException(status_code=404, detail="Explanation not found for this run")
        
    return res.data[0]["response_data"]
