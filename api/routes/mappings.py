"""CRUD /mappings — saved column mapping templates per organization."""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional

from api.auth import CurrentUser, get_current_user
from api.db import get_db
from api.routes.reconcile import _ensure_org

router = APIRouter()


class MappingTemplateIn(BaseModel):
    name: str                          # e.g. "Razorpay", "HDFC Bank"
    source_type: str = "source"        # 'source' | 'target'
    mappings: dict                     # {"id": "txn_id", "party": "merchant", ...}
    amount_mode: str = "single"


class MappingTemplateOut(MappingTemplateIn):
    id: str
    org_id: str
    created_at: str


@router.get("/", response_model=list[MappingTemplateOut])
def list_templates(user: CurrentUser = Depends(get_current_user)):
    """Return all saved column mapping templates for the organization."""
    db     = get_db()
    org_id = _ensure_org(db, user)

    result = (
        db.table("column_mapping_templates")
        .select("*")
        .eq("org_id", org_id)
        .order("created_at", desc=True)
        .execute()
    )
    return result.data or []


@router.post("/", response_model=MappingTemplateOut, status_code=201)
def create_template(
    body: MappingTemplateIn,
    user: CurrentUser = Depends(get_current_user),
):
    """Save a new column mapping template for the organization."""
    db     = get_db()
    org_id = _ensure_org(db, user)

    result = (
        db.table("column_mapping_templates")
        .insert({
            "org_id":      org_id,
            "name":        body.name,
            "source_type": body.source_type,
            "mappings":    body.mappings,
            "amount_mode": body.amount_mode,
        })
        .execute()
    )
    return result.data[0]


@router.delete("/{template_id}", status_code=204)
def delete_template(
    template_id: str,
    user: CurrentUser = Depends(get_current_user),
):
    """Delete a saved template. Only members of the owning org can delete."""
    db     = get_db()
    org_id = _ensure_org(db, user)

    result = (
        db.table("column_mapping_templates")
        .delete()
        .eq("id", template_id)
        .eq("org_id", org_id)   # org isolation
        .execute()
    )

    if not result or not getattr(result, "data", None):
        raise HTTPException(status_code=404, detail="Template not found.")
