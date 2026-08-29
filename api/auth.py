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


class CurrentUser(BaseModel):
    clerk_user_id: str
    org_id: Optional[str] = None
    org_role: Optional[str] = None
    email: Optional[str] = None


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

    return CurrentUser(
        clerk_user_id=payload.get("sub", ""),
        org_id=payload.get("org_id"),
        org_role=payload.get("org_role"),
        email=payload.get("email"),
    )
