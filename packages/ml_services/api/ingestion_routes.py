from typing import Optional, cast
import csv
import io
import json
import calendar
from datetime import date
from pathlib import Path

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from ml_services.emissions.csv_engine import calculate_emissions_from_tabular_rows
from ml_services.recommendations.service import generate_and_store_recommendations
from ml_services.common.authz import ensure_permission, ensure_user_in_org
from ml_services.common.supabase_client import supabase


router = APIRouter(prefix="/ingestion", tags=["Ingestion"])


def _auto_create_cycle(
    organization_id: str,
    upload_id: Optional[str],
    total_tco2e: float,
    category_breakdown: dict,
) -> Optional[str]:
    """
    Group 1.8 — after a successful ingestion, create an assessment_cycles row
    with source_type = 'csv_upload' and fire the analyze step.
    Returns the new cycle_id, or None on failure (non-fatal).
    """
    try:
        today = date.today()
        last_day = calendar.monthrange(today.year, today.month)[1]
        period_start = today.replace(day=1).isoformat()
        period_end = today.replace(day=last_day).isoformat()
        period_label = today.strftime("%b %Y")

        row = {
            "organization_id":       organization_id,
            "period_label":          period_label,
            "period_start":          period_start,
            "period_end":            period_end,
            "source_type":           "csv_upload",
            "source_upload_id":      upload_id,
            "total_emissions_tco2e": total_tco2e,
            "category_breakdown":    category_breakdown,
            "status":                "processing",
        }
        res = supabase.table("assessment_cycles").insert(row).execute()
        cycle_id: str = cast(dict, res.data[0])["id"]

        # Fire analyze: recommendations + compliance association
        from ml_services.api.assessment_cycles_routes import analyze_cycle, AnalyzeCycleRequest
        analyze_cycle(cycle_id, AnalyzeCycleRequest())

        return cycle_id
    except Exception as exc:
        print(f"[ingestion] Auto-cycle creation failed (non-fatal): {exc}")
        return None

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

        # Group 1.8 — auto-create assessment cycle for this upload
        by_cat = summary["breakdown"].get("by_category_kg_co2e", {})
        total_tco2e = summary["totals"]["total_kg_co2e"] / 1000.0
        cat_tco2e = {k: round(v / 1000.0, 4) for k, v in by_cat.items()}
        cycle_id = _auto_create_cycle(organization_id, None, total_tco2e, cat_tco2e)

        return {
            "csv_summary": summary,
            "recommendation_result": rec,
            "cycle_id": cycle_id,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"CSV recommendation flow failed: {e}")


# ---------------------------------------------------------------------------
# Group 1.10 — Entry edit / delete with cycle-recompute guard
# ---------------------------------------------------------------------------

def _find_ready_cycle_for_entry(organization_id: str, entry_date: Optional[str]) -> Optional[dict]:
    """
    If entry_date falls within a ready assessment_cycle for this org,
    return that cycle row so we can recompute it. Otherwise return None.
    """
    if not entry_date:
        return None
    try:
        res = (
            supabase.table("assessment_cycles")
            .select("*")
            .eq("organization_id", organization_id)
            .eq("status", "ready")
            .lte("period_start", entry_date)
            .gte("period_end", entry_date)
            .limit(1)
            .execute()
        )
        rows = cast(list, res.data)
        return cast(dict, rows[0]) if rows else None
    except Exception:
        return None


def _recompute_cycle_totals(cycle_id: str, organization_id: str) -> None:
    """
    After an entry edit/delete, re-aggregate all emission_entries within
    the cycle's period and update assessment_cycles.total_emissions_tco2e.
    Then re-run the analyze step so recommendations/compliance stay current.
    This is non-fatal — the edit always succeeds regardless.
    """
    try:
        # Get cycle period boundaries
        cycle_res = (
            supabase.table("assessment_cycles")
            .select("period_start,period_end")
            .eq("id", cycle_id)
            .single()
            .execute()
        )
        if not cycle_res.data:
            return
        cycle_row = cast(dict, cycle_res.data)
        period_start: str = cycle_row["period_start"]
        period_end: str = cycle_row["period_end"]

        # Sum all emission_entries in this period for this org
        entries_res = (
            supabase.table("emission_entries")
            .select("kg_co2e, category")
            .eq("organization_id", organization_id)
            .gte("date", period_start)
            .lte("date", period_end)
            .execute()
        )
        entries: list[dict] = cast(list, entries_res.data or [])

        total_kg = sum(float(e.get("kg_co2e") or 0) for e in entries)
        total_tco2e = round(total_kg / 1000.0, 4)

        # Rebuild category_breakdown
        cat_breakdown: dict = {}
        for e in entries:
            cat = e.get("category") or "Other"
            cat_breakdown[cat] = round(cat_breakdown.get(cat, 0.0) + float(e.get("kg_co2e") or 0) / 1000.0, 4)

        # Update cycle row — set back to processing so UI shows stale indicator
        supabase.table("assessment_cycles").update({
            "total_emissions_tco2e": total_tco2e,
            "category_breakdown": cat_breakdown,
            "status": "processing",
        }).eq("id", cycle_id).execute()

        # Re-run analyze (recommendations + compliance)
        from ml_services.api.assessment_cycles_routes import analyze_cycle, AnalyzeCycleRequest
        analyze_cycle(cycle_id, AnalyzeCycleRequest(run_recommendations=True, run_compliance=True))

        print(f"[1.10] Recomputed cycle {cycle_id}: {total_tco2e} tCO₂e from {len(entries)} entries")

    except Exception as exc:
        # Non-fatal: the edit succeeded, recompute failed
        print(f"[1.10] Cycle recompute failed (non-fatal) for cycle {cycle_id}: {exc}")


from pydantic import BaseModel as _BaseModel


class EntryUpdatePayload(_BaseModel):
    organization_id: str
    user_id: str
    kg_co2e: Optional[float] = None
    category: Optional[str] = None
    scope: Optional[str] = None
    date: Optional[str] = None
    notes: Optional[str] = None


@router.put("/entries/{entry_id}", summary="Edit an emission entry (Group 1.10)")
def update_emission_entry(entry_id: str, payload: EntryUpdatePayload):
    """
    Update an emission entry. If the entry's date falls within a ready
    assessment cycle, automatically recomputes cycle totals and re-runs
    the analyze step so recommendations/compliance stay current.
    Edit always succeeds — recompute is non-fatal.
    """
    try:
        ensure_user_in_org(payload.user_id, payload.organization_id)

        # Fetch current entry to get its date
        current_res = (
            supabase.table("emission_entries")
            .select("date, organization_id")
            .eq("id", entry_id)
            .eq("organization_id", payload.organization_id)
            .single()
            .execute()
        )
        if not current_res.data:
            raise HTTPException(status_code=404, detail="Entry not found or not in your organization")

        entry_date = payload.date or cast(dict, current_res.data).get("date")

        # Apply the update
        update_fields = {k: v for k, v in {
            "kg_co2e": payload.kg_co2e,
            "category": payload.category,
            "scope": payload.scope,
            "date": payload.date,
            "notes": payload.notes,
        }.items() if v is not None}

        if not update_fields:
            raise HTTPException(status_code=400, detail="No fields provided for update")

        supabase.table("emission_entries").update(update_fields).eq("id", entry_id).execute()

        # Group 1.10 — recompute if within a ready cycle
        affected_cycle = _find_ready_cycle_for_entry(payload.organization_id, entry_date)
        if affected_cycle:
            _recompute_cycle_totals(affected_cycle["id"], payload.organization_id)
            return {"updated": True, "recomputed_cycle_id": affected_cycle["id"]}

        return {"updated": True, "recomputed_cycle_id": None}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Entry update failed: {e}")


@router.delete("/entries/{entry_id}", summary="Delete an emission entry (Group 1.10)")
def delete_emission_entry(
    entry_id: str,
    organization_id: str,
    user_id: str,
):
    """
    Delete an emission entry. If the entry's date falls within a ready
    assessment cycle, automatically recomputes cycle totals afterward.
    Delete always succeeds — recompute is non-fatal.
    """
    try:
        ensure_user_in_org(user_id, organization_id)

        # Fetch before delete to capture the date
        current_res = (
            supabase.table("emission_entries")
            .select("date, organization_id")
            .eq("id", entry_id)
            .eq("organization_id", organization_id)
            .single()
            .execute()
        )
        if not current_res.data:
            raise HTTPException(status_code=404, detail="Entry not found or not in your organization")

        entry_date: Optional[str] = cast(dict, current_res.data).get("date")

        # Delete the entry
        supabase.table("emission_entries").delete().eq("id", entry_id).execute()

        # Group 1.10 — recompute if within a ready cycle
        affected_cycle = _find_ready_cycle_for_entry(organization_id, entry_date)
        if affected_cycle:
            _recompute_cycle_totals(affected_cycle["id"], organization_id)
            return {"deleted": True, "recomputed_cycle_id": affected_cycle["id"]}

        return {"deleted": True, "recomputed_cycle_id": None}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Entry delete failed: {e}")

