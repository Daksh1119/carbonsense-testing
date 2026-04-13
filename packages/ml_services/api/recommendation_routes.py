from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from ml_services.common.authz import ensure_permission, ensure_user_in_org
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
