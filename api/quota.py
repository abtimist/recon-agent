import datetime
from fastapi import HTTPException
from api.db import get_db
from api.entitlements import get_entitlement

def _get_current_billing_period() -> str:
    """Returns YYYY-MM for the current UTC month."""
    now = datetime.datetime.now(datetime.timezone.utc)
    return now.strftime("%Y-%m")

def check_and_increment_quota(org_id: str, plan: str, runs_requested: int = 1):
    """
    Checks if the org has enough quota for `runs_requested`.
    If yes, increments the usage in the database.
    If no, raises HTTP 429 Too Many Requests.
    """
    if not org_id:
        return # Skip quota check if there's no org (shouldn't happen in authenticated routes)
    
    entitlement = get_entitlement(plan)
    period = _get_current_billing_period()
    db = get_db()
    
    # Check max batch size limit first
    if runs_requested > entitlement.max_batch_size:
        raise HTTPException(
            status_code=429,
            detail=f"Requested batch size ({runs_requested}) exceeds your tier's maximum batch limit ({entitlement.max_batch_size})."
        )
    
    # We must fetch the internal org UUID first since usage table refs `organizations.id` not `clerk_org_id`
    org_res = db.table("organizations").select("id").eq("clerk_org_id", org_id).maybe_single().execute()
    if not org_res or not getattr(org_res, "data", None):
        # Fallback in case org_id is already the uuid
        internal_org_id = org_id
    else:
        internal_org_id = org_res.data["id"]

    # Upsert the usage record (so we can safely read it)
    # The ON CONFLICT logic requires a raw query or we can just fetch and then update/insert.
    # We'll fetch first.
    usage_res = db.table("organization_usage").select("recon_runs_used").eq("org_id", internal_org_id).eq("billing_period", period).maybe_single().execute()
    
    current_usage = 0
    if usage_res and getattr(usage_res, "data", None):
        current_usage = usage_res.data.get("recon_runs_used", 0)
        
    if current_usage + runs_requested > entitlement.max_runs:
        raise HTTPException(
            status_code=429,
            detail=f"Quota Exceeded. Your plan ('{plan}') allows {entitlement.max_runs} runs per month. You have {current_usage} used and requested {runs_requested}."
        )

    # Increment
    new_usage = current_usage + runs_requested
    
    if usage_res and getattr(usage_res, "data", None):
        db.table("organization_usage").update({"recon_runs_used": new_usage, "updated_at": datetime.datetime.now(datetime.timezone.utc).isoformat()}).eq("org_id", internal_org_id).eq("billing_period", period).execute()
    else:
        db.table("organization_usage").insert({
            "org_id": internal_org_id,
            "billing_period": period,
            "recon_runs_used": new_usage
        }).execute()
    
