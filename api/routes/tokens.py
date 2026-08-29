from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
import secrets
import hashlib
from typing import List, Optional
from datetime import datetime, timezone

from api.auth import CurrentIdentity, RequiresRole
from api.db import get_db
from api.routes.reconcile import _ensure_org

router = APIRouter()

class CreateTokenRequest(BaseModel):
    name: str

class TokenCreatedResponse(BaseModel):
    id: str
    name: str
    token_prefix: str
    raw_token: str
    created_at: str
    scopes: List[str]

class TokenResponse(BaseModel):
    id: str
    name: str
    token_prefix: str
    created_at: str
    last_used_at: Optional[str] = None
    revoked_at: Optional[str] = None
    scopes: List[str]

@router.post("/", response_model=TokenCreatedResponse)
def create_token(
    request: CreateTokenRequest,
    user: CurrentIdentity = Depends(RequiresRole("admin"))
):
    """
    Generate a new Personal Access Token.
    Returns the raw token exactly once.
    """
    db = get_db()
    org_id = _ensure_org(db, user)

    # Generate 32 bytes of entropy
    secret = secrets.token_urlsafe(32)
    raw_token = f"ra_live_{secret}"
    token_prefix = f"ra_live_{secret[:4]}"
    
    # Hash for storage
    token_hash = hashlib.sha256(raw_token.encode("utf-8")).hexdigest()

    scopes = ["reconcile", "history", "export", "explain"]

    result = db.table("api_tokens").insert({
        "org_id": org_id,
        "clerk_user_id": user.clerk_user_id,
        "name": request.name,
        "token_prefix": token_prefix,
        "token_hash": token_hash,
        "scopes": scopes
    }).execute()

    if not result or not getattr(result, "data", None):
        raise HTTPException(status_code=500, detail="Failed to create token.")

    row = result.data[0]

    return TokenCreatedResponse(
        id=row["id"],
        name=row["name"],
        token_prefix=row["token_prefix"],
        raw_token=raw_token,
        created_at=row["created_at"],
        scopes=row["scopes"]
    )

@router.get("/", response_model=List[TokenResponse])
def list_tokens(user: CurrentIdentity = Depends(RequiresRole("admin"))):
    """
    List all tokens for the user's organization.
    """
    db = get_db()
    org_id = _ensure_org(db, user)

    result = (
        db.table("api_tokens")
        .select("id, name, token_prefix, created_at, last_used_at, revoked_at, scopes")
        .eq("org_id", org_id)
        .order("created_at", desc=True)
        .execute()
    )

    if not result or not getattr(result, "data", None):
        return []

    return [
        TokenResponse(
            id=row["id"],
            name=row["name"],
            token_prefix=row["token_prefix"],
            created_at=row["created_at"],
            last_used_at=row.get("last_used_at"),
            revoked_at=row.get("revoked_at"),
            scopes=row.get("scopes", [])
        )
        for row in result.data
    ]

@router.delete("/{token_id}", status_code=status.HTTP_204_NO_CONTENT)
def revoke_token(
    token_id: str,
    user: CurrentIdentity = Depends(RequiresRole("admin"))
):
    """
    Revoke a Personal Access Token.
    """
    db = get_db()
    org_id = _ensure_org(db, user)

    # We do a soft delete (revoked_at)
    db.table("api_tokens").update({
        "revoked_at": datetime.now(timezone.utc).isoformat()
    }).eq("id", token_id).eq("org_id", org_id).execute()
    
    # We return 204 regardless of if it existed, to avoid leaking token existence
    return
