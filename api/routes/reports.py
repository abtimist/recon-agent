"""
POST /export/single/excel    — download Excel for a single reconciliation result
POST /export/single/pdf      — download PDF for a single reconciliation result
POST /export/batch/excel     — download Excel for a batch reconciliation result
POST /export/batch/pdf       — download PDF for a batch reconciliation result

Security model:
  - All endpoints require a valid Clerk JWT (get_current_user dependency).
  - The client sends back the exact result payload it received from /reconcile.
  - The backend validates the payload against strict Pydantic schemas.
  - No DB reads or writes; no report persistence; no shared URLs.
  - Oversized payloads are rejected (max_runs guard on batch).
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from typing import Optional
import io

from api.auth import CurrentUser, get_current_user

router = APIRouter()


# ---------------------------------------------------------------------------
# Payload schemas — strict Pydantic validation on every incoming payload
# ---------------------------------------------------------------------------

class _DuplicateGroup(BaseModel):
    amount:      float
    party:       str
    date:        str
    occurrences: int
    row_ids:     list[str]

class _DuplicateReport(BaseModel):
    source:       list[_DuplicateGroup]
    target:       list[_DuplicateGroup]
    source_count: int
    target_count: int

class _DashboardSummary(BaseModel):
    total_amount:              float
    matched_amount:            float
    unmatched_amount:          float
    top_exception_merchants:   list[dict]
    exceptions_by_date:        list[dict]

class SingleResultPayload(BaseModel):
    """Strict schema for a single reconciliation result."""
    run_id:            str
    status:            str
    source_filename:   Optional[str] = None
    target_filename:   Optional[str] = None
    total_source_rows: int
    total_matched:     int
    match_rate:        float
    exact_matches:     int
    fuzzy_matches:     int
    ai_matches:        int
    exceptions_count:  int
    exception_report:  list[dict] = Field(default_factory=list, max_length=50000)
    ai_provider:       str
    amount_tolerance:  float
    date_window_days:  int
    duplicates:        _DuplicateReport
    summary:           _DashboardSummary
    completed_at:      Optional[str] = None


class _BatchRunResult(BaseModel):
    source_filename: str
    target_filename: str
    status:          str
    error:           Optional[str]  = None
    result:          Optional[SingleResultPayload] = None

class _BatchSummary(BaseModel):
    total_transactions:    int
    total_matched:         int
    total_exceptions:      int
    overall_match_rate:    float
    total_amount:          float
    total_matched_amount:  float
    total_unmatched_amount: float
    duplicate_source_groups: int
    duplicate_target_groups: int
    completed_runs:        int
    failed_runs:           int

class BatchResultPayload(BaseModel):
    """Strict schema for a batch reconciliation result."""
    summary: _BatchSummary
    runs:    list[_BatchRunResult] = Field(max_length=20)


# ---------------------------------------------------------------------------
# Shared streaming helper
# ---------------------------------------------------------------------------

def _stream(content: bytes, media_type: str, filename: str) -> StreamingResponse:
    return StreamingResponse(
        io.BytesIO(content),
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ---------------------------------------------------------------------------
# Single — Excel
# ---------------------------------------------------------------------------

@router.post("/single/excel")
def export_single_excel(
    payload: SingleResultPayload,
    _user:   CurrentUser = Depends(get_current_user),
):
    """Generate and stream an Excel report for a single reconciliation run."""
    try:
        from core.report_generator import generate_single_excel
        data     = generate_single_excel(payload.model_dump())
        run_slug = str(payload.run_id)[:8]
        return _stream(data,
                       "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                       f"recon_report_{run_slug}.xlsx")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate Excel: {e}")


# ---------------------------------------------------------------------------
# Single — PDF
# ---------------------------------------------------------------------------

@router.post("/single/pdf")
def export_single_pdf(
    payload: SingleResultPayload,
    _user:   CurrentUser = Depends(get_current_user),
):
    """Generate and stream a PDF report for a single reconciliation run."""
    try:
        from core.report_generator import generate_single_pdf
        data     = generate_single_pdf(payload.model_dump())
        run_slug = str(payload.run_id)[:8]
        return _stream(data, "application/pdf", f"recon_report_{run_slug}.pdf")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate PDF: {e}")


# ---------------------------------------------------------------------------
# Batch — Excel
# ---------------------------------------------------------------------------

@router.post("/batch/excel")
def export_batch_excel(
    payload: BatchResultPayload,
    _user:   CurrentUser = Depends(get_current_user),
):
    """Generate and stream an Excel report for a batch reconciliation run."""
    try:
        from core.report_generator import generate_batch_excel
        data = generate_batch_excel(payload.model_dump())
        return _stream(data,
                       "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                       "recon_batch_report.xlsx")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate batch Excel: {e}")


# ---------------------------------------------------------------------------
# Batch — PDF
# ---------------------------------------------------------------------------

@router.post("/batch/pdf")
def export_batch_pdf(
    payload: BatchResultPayload,
    _user:   CurrentUser = Depends(get_current_user),
):
    """Generate and stream a PDF report for a batch reconciliation run."""
    try:
        from core.report_generator import generate_batch_pdf
        data = generate_batch_pdf(payload.model_dump())
        return _stream(data, "application/pdf", "recon_batch_report.pdf")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate batch PDF: {e}")
