import hashlib
import json
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from ml_services.common.authz import ensure_permission, ensure_user_in_org
from ml_services.common.supabase_client import supabase
from ml_services.recommendations.service import (
    generate_and_store_recommendations,
    list_session_recommendations,
    save_feedback,
)


router = APIRouter(prefix="/recommendations", tags=["Recommendations"])


class KPISnapshotInput(BaseModel):
    kpi_name: str
    kpi_value: float
    kpi_unit: Optional[str] = None
    period_start: Optional[str] = None
    period_end: Optional[str] = None
    meta: Dict[str, Any] = Field(default_factory=dict)


class GenerateRecommendationsInput(BaseModel):
    organization_id: str
    user_id: str
    project_name: Optional[str] = None
    location: Optional[str] = None
    emission_kg: Optional[float] = None
    time_horizon_years: int = 15
    target_recommendation_count: Optional[int] = None
    teme_run_id: Optional[str] = None
    teme_result: Dict[str, Any] = Field(default_factory=dict)
    kpi_snapshots: List[KPISnapshotInput] = Field(default_factory=list)
    force_refresh: bool = False  # When True, bypasses the 7-day cache and forces a new LLM call
    emissions_upload_id: Optional[str] = None  # When set, scopes recommendations to this specific upload


class FeedbackInput(BaseModel):
    user_id: str
    feedback_type: str
    feedback_text: Optional[str] = None
    feedback_payload: Dict[str, Any] = Field(default_factory=dict)


class ItemStatusUpdate(BaseModel):
    """Group 3A.3 — update implementation_status on a recommendation_items row."""
    user_id: str
    implementation_status: str  # proposed | in_progress | implemented | rejected

    class Config:
        extra = "ignore"


@router.post("/generate")
def generate_recommendations(payload: GenerateRecommendationsInput):
    try:
        ensure_user_in_org(payload.user_id, payload.organization_id)
        ensure_permission(payload.user_id, payload.organization_id, "recommendations.generate")

        result = generate_and_store_recommendations(
            payload.model_dump(),
            force_refresh=payload.force_refresh,
        )
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate recommendations: {e}")


@router.get("/sessions/{session_id}")
def get_recommendation_session(session_id: str, user_id: str):
    try:
        result = list_session_recommendations(session_id, user_id)
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch recommendation session: {e}")


@router.post("/sessions/{session_id}/recommendations/{recommendation_id}/feedback")
def create_recommendation_feedback(session_id: str, recommendation_id: str, payload: FeedbackInput):
    try:
        row = save_feedback(
            session_id=session_id,
            recommendation_id=recommendation_id,
            user_id=payload.user_id,
            feedback=payload.model_dump(),
        )
        return {"feedback": row}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save recommendation feedback: {e}")


# ---------------------------------------------------------------------------
# Group 3A.3 — recommendation_items endpoints
# ---------------------------------------------------------------------------

@router.get("/items")
def list_recommendation_items(
    organization_id: str,
    upload_id: Optional[str] = None,
    status: Optional[str] = None,
):
    """
    List recommendations for an organization from the recommendations table.
    - If upload_id is provided, returns tactical recommendations scoped to that specific upload.
    - If upload_id is omitted or 'all', returns the persistent Enterprise Decarbonization Roadmap.
    Optionally filter by implementation_status.
    """
    try:
        session_id = None
        session_info: Dict[str, Any] = {}
        clean_upload_id = upload_id.strip() if upload_id else None
        is_upload_mode = bool(clean_upload_id and clean_upload_id.lower() != "all")

        if is_upload_mode:
            # 1. Lookup by input_hash (upload::{org_id}::{upload_id})
            upload_hash = hashlib.sha256(f"upload::{organization_id}::{clean_upload_id}".encode("utf-8")).hexdigest()
            sess_res = (
                supabase.table("recommendation_sessions")
                .select("id, project_name, emission_kg, created_at, input_hash, input_payload")
                .eq("organization_id", organization_id)
                .eq("input_hash", upload_hash)
                .eq("status", "generated")
                .order("created_at", desc=True)
                .limit(1)
                .execute()
            )
            if sess_res.data:
                session_info = sess_res.data[0]
                session_id = session_info["id"]
            else:
                # 2. Check by input_payload->>emissions_upload_id
                all_org_sess = (
                    supabase.table("recommendation_sessions")
                    .select("id, project_name, emission_kg, created_at, input_hash, input_payload")
                    .eq("organization_id", organization_id)
                    .eq("status", "generated")
                    .order("created_at", desc=True)
                    .limit(50)
                    .execute()
                )
                for s in (all_org_sess.data or []):
                    payload = s.get("input_payload") or {}
                    if isinstance(payload, dict) and str(payload.get("emissions_upload_id") or "") == clean_upload_id:
                        session_info = s
                        session_id = s["id"]
                        break

            # 3. If still not found, check organization_uploads for filename match
            if not session_id:
                up_res = (
                    supabase.table("organization_uploads")
                    .select("original_file_name, total_emissions_kg")
                    .eq("id", clean_upload_id)
                    .limit(1)
                    .execute()
                )
                if up_res.data:
                    fname = up_res.data[0].get("original_file_name")
                    if fname:
                        fname_res = (
                            supabase.table("recommendation_sessions")
                            .select("id, project_name, emission_kg, created_at, input_hash, input_payload")
                            .eq("organization_id", organization_id)
                            .eq("project_name", fname)
                            .eq("status", "generated")
                            .order("created_at", desc=True)
                            .limit(1)
                            .execute()
                        )
                        if fname_res.data:
                            session_info = fname_res.data[0]
                            session_id = session_info["id"]

        else:
            # Enterprise / All Uploads mode
            all_org_sess = (
                supabase.table("recommendation_sessions")
                .select("id, project_name, emission_kg, created_at, input_hash, input_payload")
                .eq("organization_id", organization_id)
                .eq("status", "generated")
                .order("created_at", desc=True)
                .limit(50)
                .execute()
            )
            # Find an enterprise-level session (where emissions_upload_id is None / not tied to a single file)
            for s in (all_org_sess.data or []):
                payload = s.get("input_payload") or {}
                if isinstance(payload, dict) and not payload.get("emissions_upload_id"):
                    session_info = s
                    session_id = s["id"]
                    break

            # Fallback if no explicit enterprise session: use latest generated session
            if not session_id and all_org_sess.data:
                session_info = all_org_sess.data[0]
                session_id = session_info["id"]

        if not session_id:
            return {
                "items": [],
                "count": 0,
                "session_id": None,
                "mode": "upload" if is_upload_mode else "enterprise",
                "upload_id": clean_upload_id if is_upload_mode else None,
                "project_name": None,
                "emission_kg": 0,
            }

        # Step 2: fetch recommendations for that session
        q = (
            supabase.table("recommendations")
            .select(
                "id, session_id, rank, title, summary, action_type, priority, "
                "status, implementation_status, confidence_score, "
                "estimated_impact_kg_co2e, estimated_impact_kg_co2e_low, estimated_impact_kg_co2e_high, "
                "implementation_cost_usd, time_to_impact_months, rationale, recommendation_payload, "
                "assigned_to, created_at"
            )
            .eq("session_id", session_id)
            .order("rank", desc=False)
        )
        if status:
            q = q.eq("implementation_status", status)
        res = q.execute()
        rows = res.data or []

        # Map to the shape the frontend RecommendationItem expects
        items = []
        for r in rows:
            payload = r.get("recommendation_payload") or {}
            if isinstance(payload, str):
                try:
                    payload = json.loads(payload)
                except Exception:
                    payload = {}

            raw_steps = payload.get("implementation_steps") or []
            if not isinstance(raw_steps, list):
                raw_steps = []

            items.append({
                "id": r["id"],
                "session_id": r.get("session_id"),
                "title": r.get("title", ""),
                "description": r.get("summary") or r.get("rationale", ""),
                "summary": r.get("summary", ""),
                "rationale": r.get("rationale", ""),
                "category": _infer_category(r.get("action_type", ""), r.get("title", "")),
                "action_type": r.get("action_type", "reduction"),
                "priority": r.get("priority", "medium"),
                "difficulty": _infer_difficulty(r.get("implementation_cost_usd")),
                "implementation_status": r.get("implementation_status") or r.get("status") or "proposed",
                "rank": r.get("rank", 1),
                "estimated_impact_kg_co2e": r.get("estimated_impact_kg_co2e"),
                "estimated_impact_kg_co2e_low": r.get("estimated_impact_kg_co2e_low"),
                "estimated_impact_kg_co2e_high": r.get("estimated_impact_kg_co2e_high"),
                "implementation_cost_usd": r.get("implementation_cost_usd"),
                "time_to_impact_months": r.get("time_to_impact_months"),
                "confidence_score": r.get("confidence_score"),
                "implementation_steps": raw_steps,
                "assigned_to": r.get("assigned_to"),
            })

        display_name = session_info.get("project_name")
        if not is_upload_mode:
            display_name = "Enterprise Decarbonization Roadmap (All Uploads)"

        return {
            "items": items,
            "count": len(items),
            "session_id": session_id,
            "mode": "upload" if is_upload_mode else "enterprise",
            "upload_id": clean_upload_id if is_upload_mode else None,
            "project_name": display_name,
            "emission_kg": session_info.get("emission_kg"),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list recommendation items: {e}")




def _infer_category(action_type: str, title: str) -> str:
    """Map action_type and title keywords to a display category."""
    combined = (action_type + " " + title).lower()
    if any(w in combined for w in ["energy", "electricity", "hvac", "lighting", "solar", "power"]):
        return "Energy"
    if any(w in combined for w in ["transport", "commute", "travel", "fleet", "vehicle", "logistics"]):
        return "Transport"
    if any(w in combined for w in ["waste", "recycle", "landfill", "circular"]):
        return "Waste"
    if any(w in combined for w in ["purchase", "supply", "procurement", "vendor", "goods"]):
        return "Procurement"
    if any(w in combined for w in ["offset", "tree", "plant", "forest", "sequester"]):
        return "Offset"
    if any(w in combined for w in ["policy", "governance", "report", "compliance"]):
        return "Policy"
    return "Energy"  # sensible default


def _infer_difficulty(cost_usd) -> str:
    """Infer Easy/Medium/Hard from implementation cost."""
    try:
        cost = float(cost_usd or 0)
    except Exception:
        return "Medium"
    if cost <= 5000:
        return "Easy"
    if cost <= 25000:
        return "Medium"
    return "Hard"




@router.patch("/items/{item_id}/status")
def update_item_status(item_id: str, payload: ItemStatusUpdate):
    """
    Update implementation_status on a recommendation.
    Tries the recommendations table first (primary source), then falls back
    to recommendation_items (delegation child table).
    Valid transitions: proposed → in_progress → implemented | rejected.
    """
    valid_statuses = {"proposed", "in_progress", "implemented", "rejected"}
    if payload.implementation_status not in valid_statuses:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid status. Must be one of: {', '.join(valid_statuses)}"
        )
    try:
        # Try updating in the recommendations table first
        res = (
            supabase.table("recommendations")
            .update({
                "implementation_status": payload.implementation_status,
                "status_updated_at": "now()",
                "status_updated_by": payload.user_id,
            })
            .eq("id", item_id)
            .execute()
        )
        if res.data:
            return {"item": res.data[0]}

        # Fall back to recommendation_items (delegation records)
        res2 = (
            supabase.table("recommendation_items")
            .update({
                "implementation_status": payload.implementation_status,
                "status_updated_at": "now()",
                "status_updated_by": payload.user_id,
            })
            .eq("id", item_id)
            .execute()
        )
        if not res2.data:
            raise HTTPException(status_code=404, detail=f"Item {item_id} not found")
        return {"item": res2.data[0]}
    except HTTPException:
        raise
    except Exception as e:

        raise HTTPException(status_code=500, detail=f"Failed to update item status: {e}")


class ItemRatingInput(BaseModel):
    """Lightweight thumbs-up / thumbs-down feedback for catalog items."""
    user_id: str
    rating: str  # "helpful" | "not_helpful" | "not_relevant"
    feedback_text: Optional[str] = None


@router.post("/items/{item_id}/rate")
def rate_recommendation_item(item_id: str, payload: ItemRatingInput):
    """
    Submit a quality rating for a catalog recommendation item.
    Writes the rating directly to recommendation_items.user_rating.
    Requires migration 20260816_recommendation_quality.sql to be applied.
    Valid ratings: helpful | not_helpful | not_relevant
    """
    valid_ratings = {"helpful", "not_helpful", "not_relevant"}
    if payload.rating not in valid_ratings:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid rating. Must be one of: {', '.join(valid_ratings)}"
        )
    try:
        res = (
            supabase.table("recommendation_items")
            .update({
                "user_rating": payload.rating,
                "rating_updated_at": "now()",
                "rating_updated_by": payload.user_id,
            })
            .eq("id", item_id)
            .execute()
        )
        if not res.data:
            raise HTTPException(status_code=404, detail=f"Item {item_id} not found")
        return {"status": "ok", "rating": payload.rating}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save rating: {e}")




