"""
POST /reconcile

Accepts two uploaded files + column mappings, uploads to Supabase Storage, 
persists the queued job to Supabase, and returns a 202 Accepted.

Multi-tenancy: every DB write is scoped to the org_id from the Clerk JWT.
"""

import io
import uuid
import json
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from pydantic import BaseModel

from api.auth import CurrentIdentity, get_api_identity, RequiresScope
from api.db import get_db, get_redis
from api.quota import check_and_increment_quota

router = APIRouter()

# ---------------------------------------------------------------------------
# Request / response models
# ---------------------------------------------------------------------------

class JobAccepted(BaseModel):
    run_id: str
    status: str
    message: str

class BatchJobAccepted(BaseModel):
    batch_id: str
    run_ids: list[str]
    status: str
    message: str

# ---------------------------------------------------------------------------
# Helper: ensure the org exists in our DB (first-time users)
# ---------------------------------------------------------------------------

def _ensure_org(db, user: CurrentIdentity) -> str:
    effective_org_id = user.org_id or f"personal_{user.clerk_user_id}"

    result = (
        db.table("organizations")
        .select("id")
        .eq("clerk_org_id", effective_org_id)
        .maybe_single()
        .execute()
    )

    if result and getattr(result, "data", None):
        org_uuid = result.data["id"]
    else:
        new_org = (
            db.table("organizations")
            .insert({"clerk_org_id": effective_org_id, "name": "Personal Workspace" if not user.org_id else user.org_id})
            .execute()
        )
        org_uuid = new_org.data[0]["id"] if new_org and getattr(new_org, "data", None) else None
        
        if not org_uuid:
            raise HTTPException(status_code=500, detail="Failed to create organization.")

    db.table("organization_members").upsert(
        {
            "org_id":        org_uuid,
            "clerk_user_id": user.clerk_user_id,
            "role":          user.org_role or "member",
        },
        on_conflict="org_id,clerk_user_id",
    ).execute()

    return org_uuid


# ---------------------------------------------------------------------------
# POST /reconcile
# ---------------------------------------------------------------------------

@router.post("/", response_model=JobAccepted, status_code=status.HTTP_202_ACCEPTED)
def reconcile(
    source_file: UploadFile   = File(...,  description="Source CSV/XLSX (e.g. gateway export)"),
    target_file: UploadFile   = File(...,  description="Target CSV/XLSX (e.g. bank statement)"),

    # Column mappings — sent as JSON strings in form fields
    source_mapping_json: str  = Form(...),
    target_mapping_json: str  = Form(...),
    source_amount_mode: str   = Form("single"),
    target_amount_mode: str   = Form("single"),
    amount_tolerance: float   = Form(20.0, ge=0.0),
    date_window_days: int     = Form(5, ge=0, le=60),

    user: CurrentIdentity = Depends(get_api_identity),
):
    """
    Queue a reconciliation job:
      1. Upload both files to Supabase storage
      2. Save the configuration and job in DB as 'queued'
      3. Return 202 Accepted with a run_id
    """
    db     = get_db()
    org_id = _ensure_org(db, user)
    run_id = str(uuid.uuid4())

    try:
        source_mapping = json.loads(source_mapping_json)
        target_mapping = json.loads(target_mapping_json)
        
        config = {
            "source_mapping": source_mapping,
            "target_mapping": target_mapping,
            "source_amount_mode": source_amount_mode,
            "target_amount_mode": target_amount_mode,
            "amount_tolerance": amount_tolerance,
            "date_window_days": date_window_days,
        }

        # --- Upload files to storage ---
        src_bytes = source_file.file.read()
        tgt_bytes = target_file.file.read()
        
        src_path = f"{org_id}/{run_id}/{source_file.filename}"
        tgt_path = f"{org_id}/{run_id}/{target_file.filename}"

        db.storage.from_("recon_files").upload(src_path, src_bytes)
        db.storage.from_("recon_files").upload(tgt_path, tgt_bytes)

        # Create a "queued" run record immediately
        db.table("recon_runs").insert({
            "id":              run_id,
            "org_id":          org_id,
            "clerk_user_id":   user.clerk_user_id,
            "status":          "queued",
            "source_filename": source_file.filename,
            "target_filename": target_file.filename,
            "source_file_url": src_path,
            "target_file_url": tgt_path,
            "config":          config,
        }).execute()
        
        # Push to Redis queue
        redis = get_redis()
        redis.lpush("recon_queue", run_id)

        return JobAccepted(
            run_id=run_id,
            status="queued",
            message="Job accepted and queued for processing."
        )

    except json.JSONDecodeError as e:
        raise HTTPException(status_code=400, detail=f"Invalid JSON mapping: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ---------------------------------------------------------------------------
# POST /reconcile/batch
# ---------------------------------------------------------------------------

@router.post("/batch", response_model=BatchJobAccepted, status_code=status.HTTP_202_ACCEPTED)
def reconcile_batch(
    source_files: list[UploadFile] = File(..., description="Source CSVs"),
    target_files: list[UploadFile] = File(..., description="Target CSVs"),

    source_mapping_json: str  = Form(...),
    target_mapping_json: str  = Form(...),
    source_amount_mode: str   = Form("single"),
    target_amount_mode: str   = Form("single"),
    amount_tolerance: float   = Form(20.0, ge=0.0),
    date_window_days: int     = Form(5, ge=0, le=60),

    user: CurrentIdentity = Depends(RequiresScope("reconcile")),
):
    if len(source_files) != len(target_files):
        raise HTTPException(status_code=400, detail="Mismatched number of source and target files.")
    if len(source_files) > 20:
        raise HTTPException(status_code=400, detail="Maximum 20 pairs allowed per batch.")
    if len(source_files) == 0:
        raise HTTPException(status_code=400, detail="No files provided.")

    db     = get_db()
    org_id = _ensure_org(db, user)

    # Quota check (fails entirely if quota exceeded before starting)
    check_and_increment_quota(org_id, user.plan, len(source_files))
    
    try:
        source_mapping = json.loads(source_mapping_json)
        target_mapping = json.loads(target_mapping_json)
        
        config = {
            "source_mapping": source_mapping,
            "target_mapping": target_mapping,
            "source_amount_mode": source_amount_mode,
            "target_amount_mode": target_amount_mode,
            "amount_tolerance": amount_tolerance,
            "date_window_days": date_window_days,
        }
        
        batch_id = str(uuid.uuid4())
        
        # Create the batch record
        db.table("recon_batches").insert({
            "id":            batch_id,
            "org_id":        org_id,
            "clerk_user_id": user.clerk_user_id,
            "status":        "queued",
        }).execute()

        run_ids = []
        for src_file, tgt_file in zip(source_files, target_files):
            run_id = str(uuid.uuid4())
            run_ids.append(run_id)
            
            src_bytes = src_file.file.read()
            tgt_bytes = tgt_file.file.read()
            
            src_path = f"{org_id}/{run_id}/{src_file.filename}"
            tgt_path = f"{org_id}/{run_id}/{tgt_file.filename}"

            db.storage.from_("recon_files").upload(src_path, src_bytes)
            db.storage.from_("recon_files").upload(tgt_path, tgt_bytes)

            # Insert initial queued state
            db.table("recon_runs").insert({
                "id":              run_id,
                "org_id":          org_id,
                "batch_id":        batch_id,
                "clerk_user_id":   user.clerk_user_id,
                "status":          "queued",
                "source_filename": src_file.filename,
                "target_filename": tgt_file.filename,
                "source_file_url": src_path,
                "target_file_url": tgt_path,
                "config":          config,
            }).execute()
            
        # Push to Redis queue
        redis = get_redis()
        for run_id in run_ids:
            redis.lpush("recon_queue", run_id)
            
        return BatchJobAccepted(
            batch_id=batch_id,
            run_ids=run_ids,
            status="queued",
            message="Batch jobs accepted and queued for processing."
        )
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=400, detail=f"Invalid JSON mapping: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
