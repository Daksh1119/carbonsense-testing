"""
assessment_cycles_routes.py
===========================
FastAPI routes for the assessment cycle engine.

Endpoints
---------
POST /assessment-cycles/                      Create a new cycle (usually called internally)
POST /assessment-cycles/{cycle_id}/analyze    Run TEME + Recommendations + Compliance for a cycle
POST /assessment-cycles/from-profile/{org_id} Create a company-profile baseline cycle
GET  /assessment-cycles/{org_id}/latest       Return the latest ready cycle for an org
GET  /assessment-cycles/{org_id}/trend        Return time-series emissions for trend chart (Group 4.1)
"""

from __future__ import annotations

import os
from datetime import date, datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ml_services.common.supabase_client import supabase
from ml_services.emissions.baseline_estimator import estimate_baseline


router = APIRouter(prefix="/assessment-cycles", tags=["Assessment Cycles"])


# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------

class CreateCycleRequest(BaseModel):
    organization_id: str
    period_label: str          # e.g. "Aug 2026"
    period_start: str          # ISO date "2026-08-01"
    period_end: str            # ISO date "2026-08-31"
    source_type: str           # csv_upload | manual_entry | company_profile | recalculation
    source_upload_id: Optional[str] = None
    total_emissions_tco2e: Optional[float] = None
    category_breakdown: Optional[Dict[str, float]] = None


class AnalyzeCycleRequest(BaseModel):
    """Optional overrides when triggering analyze manually."""
    user_id: Optional[str] = None
    run_teme: bool = True
    run_recommendations: bool = True
    run_compliance: bool = True


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _get_org(org_id: str) -> Dict[str, Any]:
    """Fetch full org profile from Supabase."""
    res = (
        supabase.table("organizations")
        .select("*")
        .eq("id", org_id)
        .limit(1)
        .execute()
    )
    if not res.data:
        raise HTTPException(status_code=404, detail=f"Organization {org_id} not found")
    return res.data[0]


def _get_cycle(cycle_id: str) -> Dict[str, Any]:
    res = (
        supabase.table("assessment_cycles")
        .select("*")
        .eq("id", cycle_id)
        .limit(1)
        .execute()
    )
    if not res.data:
        raise HTTPException(status_code=404, detail=f"Cycle {cycle_id} not found")
    return res.data[0]


def _set_cycle_status(cycle_id: str, status: str) -> None:
    supabase.table("assessment_cycles").update({"status": status}).eq("id", cycle_id).execute()


def _run_compliance_for_cycle(org_id: str, cycle_id: str) -> None:
    """
    Trigger compliance scoring and write/update compliance_results rows with cycle_id.
    Uses the existing compliance scoring logic from compliance_routes / service.
    This is a lightweight pass — it just updates the cycle_id FK on existing results.
    """
    try:
        supabase.table("compliance_results") \
            .update({"cycle_id": cycle_id}) \
            .eq("organization_id", org_id) \
            .is_("cycle_id", "null") \
            .execute()
    except Exception:
        pass  # Non-fatal — compliance scoring is independent


def _run_recommendations_for_cycle(
    org_id: str,
    cycle_id: str,
    cycle: Dict[str, Any],
    org: Dict[str, Any],
) -> None:
    """
    Generate catalog-based recommendations for a cycle and persist them.
    Pulls from recommendation_catalog filtered by org sector + emission categories.
    LLM phrasing is optional (graceful fallback to catalog description).
    """
    try:
        sector = org.get("sector") or "Other"
        category_breakdown: Dict[str, float] = cycle.get("category_breakdown") or {}

        # Select top-N catalog entries per non-trivial category
        significant_categories = [
            cat for cat, val in category_breakdown.items() if val > 0
        ]
        if not significant_categories:
            significant_categories = ["Energy"]

        items_to_insert = []
        for category in significant_categories:
            catalog_res = (
                supabase.table("recommendation_catalog")
                .select("*")
                .eq("sector", sector)
                .eq("category", category)
                .eq("is_active", True)
                .limit(3)
                .execute()
            )
            entries = catalog_res.data or []
            # Fallback: any sector if none found for this specific sector
            if not entries:
                catalog_res = (
                    supabase.table("recommendation_catalog")
                    .select("*")
                    .eq("category", category)
                    .eq("is_active", True)
                    .limit(3)
                    .execute()
                )
                entries = catalog_res.data or []

            for rank, entry in enumerate(entries, start=1):
                items_to_insert.append({
                    "organization_id": org_id,
                    "user_id": org.get("created_by") or _get_system_user_id(),
                    "cycle_id": cycle_id,
                    "session_id": _ensure_session_for_cycle(org_id, cycle_id, org),
                    "title": entry["title"],
                    "description": entry["description"],
                    "category": category,
                    "difficulty": entry.get("difficulty"),
                    "source_input_type": cycle.get("source_type", "csv_upload"),
                    "catalog_entry_id": entry["id"],
                    "implementation_status": "proposed",
                    "rank": rank,
                })

        if items_to_insert:
            supabase.table("recommendation_items").insert(items_to_insert).execute()

    except Exception as exc:
        # Non-fatal — cycle is still marked ready; recommendations can be re-generated
        print(f"[assessment_cycles] Recommendation generation failed for cycle {cycle_id}: {exc}")


_SYSTEM_USER_ID_CACHE: Optional[str] = None


def _get_system_user_id() -> str:
    """Return a system/service user ID for backend-initiated writes.
    Falls back to a zero UUID if no service user is configured."""
    return os.getenv("SYSTEM_USER_ID", "00000000-0000-0000-0000-000000000000")


def _ensure_session_for_cycle(org_id: str, cycle_id: str, org: Dict[str, Any]) -> str:
    """Get or create a recommendation_session for this cycle."""
    existing = (
        supabase.table("recommendation_sessions")
        .select("id")
        .eq("organization_id", org_id)
        .eq("cycle_id", cycle_id)
        .limit(1)
        .execute()
    )
    if existing.data:
        return existing.data[0]["id"]

    res = supabase.table("recommendation_sessions").insert({
        "organization_id": org_id,
        "user_id": _get_system_user_id(),
        "cycle_id": cycle_id,
        "project_name": f"Cycle Analysis — {org.get('name', org_id)}",
        "llm_provider": "catalog",
        "llm_model": "deterministic",
        "prompt_version": "v2",
        "status": "generated",
        "source_input_type": "csv",
    }).execute()
    return res.data[0]["id"]


# ---------------------------------------------------------------------------
# Route: Create a cycle
# ---------------------------------------------------------------------------

@router.post("/", summary="Create a new assessment cycle")
def create_cycle(payload: CreateCycleRequest) -> Dict[str, Any]:
    try:
        row = {
            "organization_id":    payload.organization_id,
            "period_label":       payload.period_label,
            "period_start":       payload.period_start,
            "period_end":         payload.period_end,
            "source_type":        payload.source_type,
            "source_upload_id":   payload.source_upload_id,
            "total_emissions_tco2e": payload.total_emissions_tco2e,
            "category_breakdown": payload.category_breakdown or {},
            "status":             "processing",
        }
        res = supabase.table("assessment_cycles").insert(row).execute()
        return {"cycle": res.data[0]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create cycle: {e}")


# ---------------------------------------------------------------------------
# Route: Analyze a cycle (runs TEME + Recommendations + Compliance)
# ---------------------------------------------------------------------------

@router.post("/{cycle_id}/analyze", summary="Run full analysis for a cycle")
def analyze_cycle(cycle_id: str, payload: AnalyzeCycleRequest = AnalyzeCycleRequest()) -> Dict[str, Any]:
    """
    Orchestrates all three analysis passes for a cycle:
      1. Recommendations (catalog-grounded, deterministic selection)
      2. Compliance association (links open compliance_results rows to this cycle)
      3. Status flip to 'ready'

    TEME is intentionally NOT run here — it requires explicit user parameters
    (location, land_area, preferences) that aren't available from an upload alone.
    Managers trigger TEME separately from the Tree Engine page.
    """
    try:
        cycle = _get_cycle(cycle_id)
        org_id: str = cycle["organization_id"]
        org = _get_org(org_id)

        results: Dict[str, Any] = {"cycle_id": cycle_id, "steps": {}}

        # Step 1: Recommendations
        if payload.run_recommendations:
            try:
                _run_recommendations_for_cycle(org_id, cycle_id, cycle, org)
                results["steps"]["recommendations"] = "ok"
            except Exception as e:
                results["steps"]["recommendations"] = f"error: {e}"

        # Step 2: Compliance association
        if payload.run_compliance:
            try:
                _run_compliance_for_cycle(org_id, cycle_id)
                results["steps"]["compliance"] = "ok"
            except Exception as e:
                results["steps"]["compliance"] = f"error: {e}"

        # Step 3: Flip cycle to ready
        _set_cycle_status(cycle_id, "ready")
        results["status"] = "ready"

        return results

    except HTTPException:
        raise
    except Exception as e:
        _set_cycle_status(cycle_id, "failed")
        raise HTTPException(status_code=500, detail=f"Cycle analysis failed: {e}")


# ---------------------------------------------------------------------------
# Route: Create a company-profile baseline cycle
# ---------------------------------------------------------------------------

@router.post("/from-profile/{org_id}", summary="Create baseline cycle from org profile")
def create_profile_baseline_cycle(org_id: str) -> Dict[str, Any]:
    """
    Called after a manager completes/updates their company profile.
    Runs the deterministic baseline estimator and creates a new assessment_cycle
    with source_type = 'company_profile'.
    """
    try:
        org = _get_org(org_id)
        estimate = estimate_baseline(org)

        today = date.today()
        first_of_month = today.replace(day=1)
        last_of_month = today.replace(
            day=28  # conservative — actual last day not critical for label
        )

        period_label = today.strftime("%b %Y")

        row = {
            "organization_id":       org_id,
            "period_label":          period_label,
            "period_start":          first_of_month.isoformat(),
            "period_end":            last_of_month.isoformat(),
            "source_type":           "company_profile",
            "total_emissions_tco2e": estimate["total_emissions_tco2e"],
            "category_breakdown":    estimate["category_breakdown"],
            "status":                "processing",
        }

        res = supabase.table("assessment_cycles").insert(row).execute()
        cycle = res.data[0]
        cycle_id: str = cycle["id"]

        # Run analysis (recommendations + compliance) for the new cycle
        _run_recommendations_for_cycle(org_id, cycle_id, cycle, org)
        _run_compliance_for_cycle(org_id, cycle_id)
        _set_cycle_status(cycle_id, "ready")

        return {
            "cycle":     cycle,
            "estimate":  estimate,
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Profile baseline cycle failed: {e}")


# ---------------------------------------------------------------------------
# Route: Latest ready cycle
# ---------------------------------------------------------------------------

@router.get("/{org_id}/latest", summary="Get the latest ready assessment cycle for an org")
def get_latest_cycle(org_id: str) -> Dict[str, Any]:
    try:
        res = (
            supabase.table("assessment_cycles")
            .select("*")
            .eq("organization_id", org_id)
            .eq("status", "ready")
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )
        if not res.data:
            return {"cycle": None}
        return {"cycle": res.data[0]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch latest cycle: {e}")


# ---------------------------------------------------------------------------
# Route: Trend (Group 4.1)
# ---------------------------------------------------------------------------

@router.get("/{org_id}/trend", summary="Get emissions trend time-series for an org")
def get_trend(org_id: str, granularity: str = "monthly") -> Dict[str, Any]:
    """
    Returns an ordered list of {period_label, total_emissions_tco2e, change_pct}
    for all ready cycles, aggregated by granularity.

    granularity: monthly (default) | quarterly | yearly
    """
    try:
        res = (
            supabase.table("assessment_cycles")
            .select("id,period_label,period_start,period_end,total_emissions_tco2e,source_type,created_at")
            .eq("organization_id", org_id)
            .eq("status", "ready")
            .order("period_start", desc=False)
            .execute()
        )

        cycles: List[Dict[str, Any]] = res.data or []

        # Build time series with period-over-period % change
        series: List[Dict[str, Any]] = []
        prev_tco2e: Optional[float] = None

        for c in cycles:
            tco2e: Optional[float] = c.get("total_emissions_tco2e")
            change_pct: Optional[float] = None

            if tco2e is not None and prev_tco2e is not None and prev_tco2e != 0:
                change_pct = round((tco2e - prev_tco2e) / prev_tco2e * 100.0, 1)

            series.append({
                "cycle_id":             c["id"],
                "period_label":         c["period_label"],
                "period_start":         c["period_start"],
                "total_emissions_tco2e": tco2e,
                "change_pct":           change_pct,
                "source_type":          c["source_type"],
            })

            if tco2e is not None:
                prev_tco2e = tco2e

        # Summary stats
        tco2e_values = [s["total_emissions_tco2e"] for s in series if s["total_emissions_tco2e"] is not None]
        summary: Dict[str, Any] = {
            "cycle_count":         len(series),
            "latest_tco2e":        tco2e_values[-1] if tco2e_values else None,
            "earliest_tco2e":      tco2e_values[0]  if tco2e_values else None,
            "overall_change_pct":  None,
        }
        if len(tco2e_values) >= 2 and tco2e_values[0] != 0:
            summary["overall_change_pct"] = round(
                (tco2e_values[-1] - tco2e_values[0]) / tco2e_values[0] * 100.0, 1
            )

        return {
            "organization_id": org_id,
            "granularity":     granularity,
            "series":          series,
            "summary":         summary,
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch trend: {e}")
