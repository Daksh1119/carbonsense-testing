from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from fastapi.responses import JSONResponse
from typing import Optional

from ml_services.common.authz import ensure_user_in_org, ensure_permission
from ml_services.ocr.single_processor import process_single_receipt
from ml_services.ocr.bulk_processor import process_receipt_batch
from ml_services.ocr.org_analytics import generate_org_receipt_report

router = APIRouter(prefix="/ocr", tags=["OCR"])


@router.post("/receipt")
async def process_receipt(
    file: UploadFile = File(...),
    organization_id: str = Form(...),
    uploaded_by: str = Form(...),
    employee_user_id: Optional[str] = Form(None),
):
    ensure_user_in_org(uploaded_by, organization_id)
    ensure_permission(uploaded_by, organization_id, "edit_emissions_data")
    try:
        result = await process_single_receipt(
            file=file,
            organization_id=organization_id,
            uploaded_by_user_id=uploaded_by,
            employee_user_id=employee_user_id,
        )
        return JSONResponse(result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/receipts/bulk")
async def process_bulk_receipts(
    zip_file: UploadFile = File(...),
    organization_id: str = Form(...),
    uploaded_by: str = Form(...),
):
    ensure_user_in_org(uploaded_by, organization_id)
    ensure_permission(uploaded_by, organization_id, "edit_emissions_data")
    result = await process_receipt_batch(zip_file, organization_id, uploaded_by)
    return JSONResponse(result)


@router.get("/analytics/organization")
async def org_analytics(
    organization_id: str,
    start_date: str,
    end_date: str,
    user_id: str,
):
    ensure_user_in_org(user_id, organization_id)
    ensure_permission(user_id, organization_id, "view_analytics")
    return JSONResponse(generate_org_receipt_report(organization_id, start_date, end_date))
