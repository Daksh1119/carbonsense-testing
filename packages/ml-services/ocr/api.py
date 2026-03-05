import shutil
import tempfile
import zipfile
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from fastapi.responses import JSONResponse

from ml_services.common.authz import ensure_user_in_org, ensure_permission
from ml_services.ocr.single_processor import process_single_receipt
from ml_services.ocr.bulk_processor import process_receipt_batch
from ml_services.ocr.org_analytics import generate_org_receipt_report

router = APIRouter(prefix="/ocr", tags=["OCR"])


@router.post("/receipt")
async def process_single_receipt_endpoint(
    file: UploadFile = File(...),
    organization_id: str = Form(...),
    uploaded_by: str = Form(...),
    employee_user_id: Optional[str] = Form(None),
):
    ensure_user_in_org(uploaded_by, organization_id)
    ensure_permission(uploaded_by, organization_id, "edit_emissions_data")

    suffix = Path(file.filename).suffix or ".jpg"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        shutil.copyfileobj(file.file, tmp)
        tmp_path = tmp.name

    try:
        result = process_single_receipt(
            file_path=tmp_path,
            file_name=file.filename,
            organization_id=organization_id,
            uploaded_by_user_id=uploaded_by,
            employee_user_id=employee_user_id,
        )
        return JSONResponse(result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/receipts/bulk")
async def process_bulk_receipts_endpoint(
    zip_file: UploadFile = File(...),
    organization_id: str = Form(...),
    uploaded_by: str = Form(...),
    employee_user_id: Optional[str] = Form(None),
):
    ensure_user_in_org(uploaded_by, organization_id)
    ensure_permission(uploaded_by, organization_id, "edit_emissions_data")

    with tempfile.TemporaryDirectory() as tmpdir:
        zip_path = Path(tmpdir) / "receipts.zip"
        with open(zip_path, "wb") as f:
            shutil.copyfileobj(zip_file.file, f)

        with zipfile.ZipFile(zip_path) as z:
            z.extractall(tmpdir)

        receipt_paths = [
            str(p)
            for p in Path(tmpdir).rglob("*")
            if p.suffix.lower() in [".jpg", ".jpeg", ".png", ".pdf"]
        ]

        if not receipt_paths:
            raise HTTPException(status_code=400, detail="No valid receipt files found in zip")

        result = process_receipt_batch(
            receipt_paths=receipt_paths,
            organization_id=organization_id,
            uploaded_by_user_id=uploaded_by,
            employee_user_id=employee_user_id,
        )
        return JSONResponse(result)


@router.get("/analytics/organization")
async def org_receipt_analytics_endpoint(
    organization_id: str,
    start_date: str,
    end_date: str,
    user_id: str,
):
    ensure_user_in_org(user_id, organization_id)
    ensure_permission(user_id, organization_id, "view_analytics")

    report = generate_org_receipt_report(
        organization_id=organization_id,
        start_date=start_date,
        end_date=end_date,
    )
    return JSONResponse(report)