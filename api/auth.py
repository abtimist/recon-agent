"""
Clerk JWT verification middleware for FastAPI.

Every protected endpoint uses the `get_current_user` dependency, which:
  1. Extracts the Bearer token from the Authorization header
  2. Verifies it against Clerk's JWKS endpoint
  3. Returns a CurrentUser with clerk_user_id and org_id

The JWKS are cached (TTL = 1 hour) to avoid hitting Clerk's endpoint on
every request.
"""

import os
import time
from functools import lru_cache
from typing import Optional

import httpx
from fastapi import Depends, Header, HTTPException, status
from jose import JWTError, jwt
from pydantic import BaseModel


CLERK_SECRET_KEY  = os.environ.get("CLERK_SECRET_KEY", "")
# Your Clerk Frontend API URL — found in Clerk Dashboard → API Keys
# Looks like: https://your-app.clerk.accounts.dev
CLERK_ISSUER      = os.environ.get("CLERK_ISSUER", "")


class CurrentIdentity(BaseModel):
    clerk_user_id: str
    org_id: Optional[str] = None
    org_role: Optional[str] = None
    email: Optional[str] = None
    is_pat: bool = False
    scopes: list[str] = []

# Alias for backwards compatibility where convenient
CurrentUser = CurrentIdentity


@lru_cache(maxsize=1)
def _get_jwks_cached(ttl_bucket: int) -> dict:
    """
    Fetch Clerk's public keys. ttl_bucket changes every hour to force a refresh
    without holding a lock — safe for multiple FastAPI workers.
    """
    url = f"{CLERK_ISSUER}/.well-known/jwks.json"
    response = httpx.get(url, timeout=10)
    response.raise_for_status()
    return response.json()


def _get_jwks() -> dict:
    ttl_bucket = int(time.time() // 3600)   # changes every hour
    return _get_jwks_cached(ttl_bucket)


def get_current_user(
    authorization: str = Header(..., description="Bearer <clerk_jwt>"),
) -> CurrentUser:
    """
    FastAPI dependency — inject into any endpoint that requires authentication.

    Usage:
        @router.get("/protected")
        def my_endpoint(user: CurrentUser = Depends(get_current_user)):
            ...
    """
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or malformed Authorization header (expected: Bearer <token>)",
        )

    try:
        jwks = _get_jwks()
        payload = jwt.decode(
            token,
            jwks,
            algorithms=["RS256"],
            options={"verify_aud": False},
        )
    except JWTError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid or expired token: {e}",
        )

    return CurrentIdentity(
        clerk_user_id=payload.get("sub", ""),
        org_id=payload.get("org_id"),
        org_role=payload.get("org_role"),
        email=payload.get("email"),
        is_pat=False,
    )

def get_api_identity(
    authorization: str = Header(..., description="Bearer <clerk_jwt> OR Bearer <pat>"),
) -> CurrentIdentity:
    """
    Unified identity resolver.
    If the token starts with 'ra_live_', it treats it as a PAT.
    Otherwise, it delegates to Clerk JWT validation.
    """
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or malformed Authorization header (expected: Bearer <token>)",
        )

    if not token.startswith("ra_live_"):
        # MUST be a Clerk JWT
        return get_current_user(authorization)

    # It MUST be a PAT. Do not fall back to Clerk if this fails.
    import hashlib
    from datetime import datetime, timezone
    from api.db import get_db

    token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()
    db = get_db()

    result = (
        db.table("api_tokens")
        .select("id, org_id, clerk_user_id, scopes, revoked_at")
        .eq("token_hash", token_hash)
        .maybe_single()
        .execute()
    )

    if not result or not getattr(result, "data", None):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid API token.",
        )

    row = result.data
    if row.get("revoked_at"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="API token has been revoked.",
        )

    # Update last_used_at asynchronously or just synchronously for now
    db.table("api_tokens").update(
        {"last_used_at": datetime.now(timezone.utc).isoformat()}
    ).eq("id", row["id"]).execute()

    return CurrentIdentity(
        clerk_user_id=row["clerk_user_id"],
        org_id=row["org_id"],
        org_role="system", # Or inherit from creator, but PAT acts on behalf of org
        email=None,
        is_pat=True,
        scopes=row.get("scopes", []),
    )
