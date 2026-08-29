"""GET + PUT /settings/ai — per-user AI provider configuration."""

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import Optional

from api.auth import CurrentUser, get_current_user
from api.crypto import decrypt, encrypt
from api.db import get_db
from core.ai_resolver import PROVIDERS
from api.routes.reconcile import _ensure_org

router = APIRouter()


class AIConfigOut(BaseModel):
    provider: str
    model_override: Optional[str]
    base_url_override: Optional[str]
    has_api_key: bool          # never return the actual key to the frontend


class AIConfigIn(BaseModel):
    provider: str
    api_key: Optional[str] = None   # None = don't change the stored key
    model_override: Optional[str] = None
    base_url_override: Optional[str] = None


@router.get("/ai", response_model=AIConfigOut)
def get_ai_config(user: CurrentUser = Depends(get_current_user)):
    """Return the user's current AI config (key presence only, never the key itself)."""
    db     = get_db()
    org_id = _ensure_org(db, user)
    result = (
        db.table("org_ai_config")
        .select("provider, encrypted_api_key, model_override, base_url_override")
        .eq("org_id", org_id)
        .maybe_single()
        .execute()
    )

    if not result or not getattr(result, "data", None):
        return AIConfigOut(
            provider="groq",
            model_override=None,
            base_url_override=None,
            has_api_key=False,
        )

    row = result.data
    return AIConfigOut(
        provider=row.get("provider", "groq"),
        model_override=row.get("model_override"),
        base_url_override=row.get("base_url_override"),
        has_api_key=bool(row.get("encrypted_api_key")),
    )


@router.put("/ai", response_model=AIConfigOut)
def update_ai_config(
    body: AIConfigIn,
    user: CurrentUser = Depends(get_current_user),
):
    """
    Update the user's AI config.
    If api_key is provided and non-empty, it's encrypted and stored.
    If api_key is None, the existing stored key is preserved.
    """
    if body.provider not in PROVIDERS:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail=f"Unknown provider: {body.provider}")

    db = get_db()

    org_id = _ensure_org(db, user)

    # Fetch existing record to preserve the key if not being updated
    existing = (
        db.table("org_ai_config")
        .select("encrypted_api_key")
        .eq("org_id", org_id)
        .maybe_single()
        .execute()
    )

    encrypted_key = existing.data.get("encrypted_api_key") if existing and getattr(existing, "data", None) else None
    if body.api_key:   # new key provided — encrypt and store it
        encrypted_key = encrypt(body.api_key)

    upsert_data = {
        "org_id":            org_id,
        "provider":          body.provider,
        "encrypted_api_key": encrypted_key,
        "model_override":    body.model_override,
        "base_url_override": body.base_url_override,
    }

    db.table("org_ai_config").upsert(
        upsert_data, on_conflict="org_id"
    ).execute()

    return AIConfigOut(
        provider=body.provider,
        model_override=body.model_override,
        base_url_override=body.base_url_override,
        has_api_key=bool(encrypted_key),
    )
