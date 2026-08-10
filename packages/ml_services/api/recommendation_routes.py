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

        result = generate_and_store_recommendations(payload.model_dump())
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
def list_recommendation_items(organization_id: str, status: Optional[str] = None):
    """
    List recommendation_items for an organization.
    Optionally filter by implementation_status.
    """
    try:
        q = (
            supabase.table("recommendation_items")
            .select("*")
            .eq("organization_id", organization_id)
            .order("created_at", desc=True)
        )
        if status:
            q = q.eq("implementation_status", status)
        res = q.execute()
        return {"items": res.data or [], "count": len(res.data or [])}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list recommendation items: {e}")


@router.patch("/items/{item_id}/status")
def update_item_status(item_id: str, payload: ItemStatusUpdate):
    """
    Group 3A.3 — update implementation_status on a single recommendation_item.
    Valid transitions: proposed → in_progress → implemented | rejected.
    """
    valid_statuses = {"proposed", "in_progress", "implemented", "rejected"}
    if payload.implementation_status not in valid_statuses:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid status. Must be one of: {', '.join(valid_statuses)}"
        )
    try:
        res = (
            supabase.table("recommendation_items")
            .update({
                "implementation_status": payload.implementation_status,
                "status_updated_at": "now()",
                "status_updated_by": payload.user_id,
            })
            .eq("id", item_id)
            .execute()
        )
        if not res.data:
            raise HTTPException(status_code=404, detail=f"Item {item_id} not found")
        return {"item": res.data[0]}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update item status: {e}")


