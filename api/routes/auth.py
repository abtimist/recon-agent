from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import Optional, List

from api.auth import CurrentIdentity, get_api_identity

router = APIRouter()

class AuthStatusResponse(BaseModel):
    clerk_user_id: str
    org_id: Optional[str] = None
    is_pat: bool
    scopes: List[str]

@router.get("/status", response_model=AuthStatusResponse)
def get_auth_status(user: CurrentIdentity = Depends(get_api_identity)):
    """
    Validates the active session or Personal Access Token.
    Returns basic identity information.
    """
    return AuthStatusResponse(
        clerk_user_id=user.clerk_user_id,
        org_id=user.org_id,
        is_pat=user.is_pat,
        scopes=user.scopes,
    )
