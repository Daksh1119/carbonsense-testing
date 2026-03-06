from datetime import date
from typing import List, Optional, Literal, Any
import tempfile
import os

from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Query
from pydantic import BaseModel, Field

from ml_services.common.authz import ensure_user_in_org, ensure_permission
from ml_services.ocr.single_processor import process_single_receipt
from ml_services.ocr.bulk_processor import process_receipt_batch
from ml_services.ocr.org_analytics import generate_org_receipt_report

router = APIRouter(prefix="/ocr", tags=["OCR"])

ALLOWED_SINGLE_EXT = {".jpg", ".jpeg", ".png", ".pdf"}
ALLOWED_BULK_EXT = {".zip"}
MAX_SINGLE_MB = 10
MAX_BULK_MB = 50


class OCRLineItem(BaseModel):
    description: str
    amount: float
    category: Optional[str] = None
    carbon_kg: Optional[float] = None


class OCRReceiptResponse(BaseModel):
    success: bool
    receipt_id: Optional[str] = None
    organization_id: str
    uploaded_by: str
    employee_user_id: Optional[str] = None
    vendor: Optional[str] = None
    receipt_date: Optional[str] = None
    currency: Optional[str] = "INR"
    total_amount: Optional[float] = None
    carbon_total_kg: Optional[float] = None
    confidence: float = Field(ge=0, le=1)
    requires_review: bool
    line_items: List[OCRLineItem] = Field(default_factory=list)
    raw_text: Optional[str] = None
    warnings: List[str] = Field(default_factory=list)


class OCRBulkReceiptResult(BaseModel):
    file_name: str
    success: bool
    receipt_id: Optional[str] = None
    confidence: Optional[float] = None
    requires_review: Optional[bool] = None
    error: Optional[str] = None


class OCRBulkResponse(BaseModel):
    success: bool
    organization_id: str
    uploaded_by: str
    total_files: int
    processed_count: int
    failed_count: int
    results: List[OCRBulkReceiptResult]


class OrgAnalyticsResponse(BaseModel):
    success: bool
    organization_id: str
    start_date: str
    end_date: str
    total_receipts: int
    total_amount: float
    total_carbon_kg: float
    average_carbon_per_receipt: float
    top_categories: List[dict] = Field(default_factory=list)


def _ext_ok(filename: str, allowed: set[str]) -> bool:
    _, ext = os.path.splitext((filename or "").lower())
    return ext in allowed


@router.post("/receipt", response_model=OCRReceiptResponse)
async def process_receipt(
    file: UploadFile = File(...),
    organization_id: str = Form(...),
    uploaded_by: str = Form(...),
    employee_user_id: Optional[str] = Form(None),
):
    ensure_user_in_org(uploaded_by, organization_id)
    ensure_permission(uploaded_by, organization_id, "edit_emissions_data")

    if not _ext_ok(file.filename or "", ALLOWED_SINGLE_EXT):
        raise HTTPException(status_code=400, detail=f"Unsupported file type. Allowed: {sorted(ALLOWED_SINGLE_EXT)}")

    blob = await file.read()
    if len(blob) > MAX_SINGLE_MB * 1024 * 1024:
        raise HTTPException(status_code=413, detail=f"File too large. Max {MAX_SINGLE_MB}MB")

    suffix = os.path.splitext(file.filename or "")[1] or ".jpg"

    try:
        # Save uploaded bytes to temporary file
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            tmp.write(blob)
            tmp_path = tmp.name

        result: dict[str, Any] = process_single_receipt(
            file_path=tmp_path,
            file_name=file.filename or "upload",
            organization_id=organization_id,
            uploaded_by_user_id=uploaded_by,
            employee_user_id=employee_user_id,
        )

        return OCRReceiptResponse(**result)

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"OCR processing failed: {e}")

    finally:
        # Clean up temporary file
        try:
            os.remove(tmp_path)
        except Exception:
            pass

@router.post("/receipts/bulk", response_model=OCRBulkResponse)
async def process_bulk_receipts(
    zip_file: UploadFile = File(...),
    organization_id: str = Form(...),
    uploaded_by: str = Form(...),
):
    ensure_user_in_org(uploaded_by, organization_id)
    ensure_permission(uploaded_by, organization_id, "edit_emissions_data")

    if not _ext_ok(zip_file.filename or "", ALLOWED_BULK_EXT):
        raise HTTPException(status_code=400, detail="Only .zip is allowed for bulk endpoint")

    blob = await zip_file.read()
    if len(blob) > MAX_BULK_MB * 1024 * 1024:
        raise HTTPException(status_code=413, detail=f"Zip too large. Max {MAX_BULK_MB}MB")

    try:
        result = await process_receipt_batch(
            zip_bytes=blob,
            zip_name=zip_file.filename or "batch.zip",
            organization_id=organization_id,
            uploaded_by=uploaded_by,
        )
        return OCRBulkResponse(**result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Bulk OCR failed: {e}")


@router.get("/analytics/organization", response_model=OrgAnalyticsResponse)
async def org_analytics(
    organization_id: str = Query(...),
    start_date: date = Query(...),
    end_date: date = Query(...),
    user_id: str = Query(...),
):
    ensure_user_in_org(user_id, organization_id)
    ensure_permission(user_id, organization_id, "view_analytics")

    if end_date < start_date:
        raise HTTPException(status_code=400, detail="end_date must be >= start_date")

    data = generate_org_receipt_report(
        organization_id=organization_id,
        start_date=start_date.isoformat(),
        end_date=end_date.isoformat(),
    )
    return OrgAnalyticsResponse(**data)