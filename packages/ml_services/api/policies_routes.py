from typing import Any, Dict, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from ml_services.common.authz import ensure_user_in_org, ensure_permission
from ml_services.policy_compliance.service import ask_policy, get_policy, list_policies


router = APIRouter(prefix="/policies", tags=["Policies"])


class PolicyAskInput(BaseModel):
    organization_id: str
    user_id: str
    question: str
    policy_id: Optional[str] = None
    industry: Optional[str] = None
    organization_size: Optional[str] = None
    total_emissions_kg: Optional[float] = None
    context: Dict[str, Any] = Field(default_factory=dict)


@router.get("")
def get_policies(
    category: Optional[str] = None,
    industry: Optional[str] = None,
    active_only: bool = True,
    organization_id: Optional[str] = None,
    size: Optional[str] = None,
    total_emissions_kg: Optional[float] = None,
):
    try:
        data = list_policies(
            category=category,
            industry=industry,
            active_only=active_only,
            organization_id=organization_id,
            size=size,
            total_emissions_kg=total_emissions_kg,
        )
        return {"policies": data, "count": len(data)}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch policies: {e}")


@router.get("/{policy_id}")
def get_policy_by_id(
    policy_id: str,
    organization_id: Optional[str] = None,
    industry: Optional[str] = None,
    size: Optional[str] = None,
    total_emissions_kg: Optional[float] = None,
):
    try:
        data = get_policy(
            policy_id,
            organization_id=organization_id,
            industry=industry,
            size=size,
            total_emissions_kg=total_emissions_kg,
        )
        return data
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch policy: {e}")


@router.post("/ask")
def ask_policy_route(payload: PolicyAskInput):
    try:
        ensure_user_in_org(payload.user_id, payload.organization_id)
        ensure_permission(payload.user_id, payload.organization_id, "policies.ask")

        data = ask_policy(
            organization_id=payload.organization_id,
            user_question=payload.question,
            industry=payload.industry,
            size=payload.organization_size,
            total_emissions_kg=payload.total_emissions_kg,
            policy_id=payload.policy_id,
        )
        return data
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to answer policy question: {e}")
