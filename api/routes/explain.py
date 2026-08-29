from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Any

from api.auth import CurrentUser, get_current_user, CurrentIdentity, get_api_identity
from api.db import get_db
from api.routes.reconcile import _load_org_ai_config, _ensure_org
from core.explanation_service import (
    CFOExplanationResponse,
    explain_single_result,
    explain_batch_result
)

router = APIRouter()

class ExplainRequest(BaseModel):
    type: str  # "single" or "batch"
    result: Any # dict of ReconcileResult or BatchReconcileResult

@router.post("/", response_model=CFOExplanationResponse)
def explain_result(
    request: ExplainRequest,
    user: CurrentIdentity = Depends(get_api_identity)
):
    """
    Generate an AI-powered CFO Explanation for a reconciliation result.
    Does not modify any data or perform any reconciliation.
    """
    db = get_db()
    # Ensure org access logic is executed for security, even if we don't write
    org_id = _ensure_org(db, user)

    ai_config = _load_org_ai_config(db, org_id)
    
    if ai_config.get("provider", "none") == "none":
        raise HTTPException(
            status_code=400,
            detail="AI Explanation unavailable — configure an AI provider in Settings."
        )

    # Note: request.result is an arbitrary dict sent by the frontend,
    # corresponding to the JSON of the already completed run.
    try:
        if request.type == "single":
            explanation = explain_single_result(request.result, ai_config)
        elif request.type == "batch":
            explanation = explain_batch_result(request.result, ai_config)
        else:
            raise HTTPException(status_code=400, detail="Invalid explanation type. Must be 'single' or 'batch'.")
        
        return explanation
    except ValueError as e:
        # Expected errors like parsing failures or API provider errors
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Unexpected error during AI generation: {str(e)}")
