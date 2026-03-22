from typing import Optional

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from ml_services.emissions.csv_engine import calculate_emissions_from_csv_text
from ml_services.recommendations.service import generate_and_store_recommendations
from ml_services.common.authz import ensure_permission, ensure_user_in_org


router = APIRouter(prefix="/ingestion", tags=["Ingestion"])


@router.post("/company-csv/calculate")
async def calculate_company_csv(file: UploadFile = File(...)):
    try:
        raw = await file.read()
        text = raw.decode("utf-8-sig")
        return calculate_emissions_from_csv_text(text)
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
        text = raw.decode("utf-8-sig")
        summary = calculate_emissions_from_csv_text(text)

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
