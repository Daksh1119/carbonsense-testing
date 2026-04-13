from typing import Optional
import csv
import io
import json
from pathlib import Path

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from ml_services.emissions.csv_engine import calculate_emissions_from_tabular_rows
from ml_services.recommendations.service import generate_and_store_recommendations
from ml_services.common.authz import ensure_permission, ensure_user_in_org


router = APIRouter(prefix="/ingestion", tags=["Ingestion"])

MAX_UPLOAD_BYTES = 25 * 1024 * 1024
MAX_UPLOAD_ROWS = 50000


def _parse_rows_from_upload(file: UploadFile, raw: bytes):
    if len(raw) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail=f"File too large. Max allowed is {MAX_UPLOAD_BYTES // (1024 * 1024)}MB")

    filename = (file.filename or "upload.csv").strip()
    ext = Path(filename).suffix.lower()

    if ext in {".csv", ".txt"}:
        text = raw.decode("utf-8-sig")
        reader = csv.DictReader(io.StringIO(text))
        rows = [dict(r) for r in reader]
    elif ext == ".tsv":
        text = raw.decode("utf-8-sig")
        reader = csv.DictReader(io.StringIO(text), delimiter="\t")
        rows = [dict(r) for r in reader]
    elif ext == ".json":
        text = raw.decode("utf-8-sig")
        payload = json.loads(text)
        if isinstance(payload, list):
            rows = payload
        elif isinstance(payload, dict):
            rows = payload.get("rows") or payload.get("records") or payload.get("data") or []
        else:
            rows = []
        if not isinstance(rows, list):
            raise HTTPException(status_code=400, detail="JSON payload must be an array of records or include rows/records/data array")
    elif ext in {".xlsx", ".xls"}:
        try:
            import pandas as pd
        except Exception:
            raise HTTPException(status_code=500, detail="Excel ingestion requires pandas/openpyxl in backend environment")

        frame = pd.read_excel(io.BytesIO(raw), dtype=object)
        rows = frame.fillna("").to_dict(orient="records")
    else:
        raise HTTPException(
            status_code=400,
            detail="Unsupported file format. Allowed: .csv, .tsv, .json, .xlsx, .xls",
        )

    if not rows:
        raise HTTPException(status_code=400, detail="No rows found in uploaded file")
    if len(rows) > MAX_UPLOAD_ROWS:
        raise HTTPException(status_code=413, detail=f"Too many rows. Max allowed is {MAX_UPLOAD_ROWS}")

    return rows


def _calculate_from_upload(file: UploadFile, raw: bytes):
    rows = _parse_rows_from_upload(file, raw)
    return calculate_emissions_from_tabular_rows(rows)


@router.post("/company-csv/calculate")
async def calculate_company_csv(file: UploadFile = File(...)):
    try:
        raw = await file.read()
        return _calculate_from_upload(file, raw)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"CSV processing failed: {e}")


@router.post("/company-csv/recommendations")
async def company_csv_to_recommendations(
    file: UploadFile = File(...),
    organization_id: str = Form(...),
    user_id: str = Form(...),
    project_name: Optional[str] = Form(None),
    location: Optional[str] = Form("India"),
    time_horizon_years: int = Form(15),
):
    try:
        ensure_user_in_org(user_id, organization_id)
        ensure_permission(user_id, organization_id, "recommendations.generate")

        raw = await file.read()
        summary = _calculate_from_upload(file, raw)

        payload = {
            "organization_id": organization_id,
            "user_id": user_id,
            "project_name": project_name or "CSV-based Emissions Plan",
            "location": location,
            "emission_kg": summary["totals"]["total_kg_co2e"],
            "time_horizon_years": time_horizon_years,
            "kpi_snapshots": summary.get("kpi_snapshots", []),
            "teme_result": {},
            "csv_summary": {
                "by_category_kg_co2e": summary["breakdown"]["by_category_kg_co2e"],
                "by_scope_kg_co2e": summary["breakdown"]["by_scope_kg_co2e"],
                "records_processed": summary["totals"]["records_processed"],
                "records_rejected": summary["totals"]["records_rejected"],
            },
        }

        rec = generate_and_store_recommendations(payload)
        return {
            "csv_summary": summary,
            "recommendation_result": rec,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"CSV recommendation flow failed: {e}")
