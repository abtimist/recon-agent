import pytest
from fastapi import HTTPException
from api.auth import RequiresRole, RequiresScope, RequiresTier, CurrentIdentity
from api.quota import check_and_increment_quota

def test_requires_role_success():
    req = RequiresRole("admin")
    user = CurrentIdentity(clerk_user_id="test", org_role="admin")
    assert req(user) == user

def test_requires_role_failure():
    req = RequiresRole("admin")
    user = CurrentIdentity(clerk_user_id="test", org_role="member")
    with pytest.raises(HTTPException) as exc:
        req(user)
    assert exc.value.status_code == 403

def test_requires_scope_success():
    req = RequiresScope("reconcile")
    user = CurrentIdentity(clerk_user_id="test", is_pat=True, scopes=["reconcile"])
    assert req(user) == user

def test_requires_scope_failure():
    req = RequiresScope("reconcile")
    user = CurrentIdentity(clerk_user_id="test", is_pat=True, scopes=["history"])
    with pytest.raises(HTTPException) as exc:
        req(user)
    assert exc.value.status_code == 403

def test_requires_tier_success():
    req = RequiresTier("pro")
    user = CurrentIdentity(clerk_user_id="test", plan="pro")
    assert req(user) == user
    user_ent = CurrentIdentity(clerk_user_id="test", plan="enterprise")
    assert req(user_ent) == user_ent

def test_requires_tier_failure():
    req = RequiresTier("pro")
    user = CurrentIdentity(clerk_user_id="test", plan="free")
    with pytest.raises(HTTPException) as exc:
        req(user)
    assert exc.value.status_code == 403
    assert "Plan upgrade required" in exc.value.detail

