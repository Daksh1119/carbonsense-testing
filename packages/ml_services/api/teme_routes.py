from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Dict, List, Optional, Any

from ml_services.teme.core.engine import run_teme
from ml_services.teme.core.exceptions import InfeasiblePlanError

router = APIRouter(prefix="/teme", tags=["TEME"])


class MLConfig(BaseModel):
    enabled: bool = False


class Constraints(BaseModel):
    max_land_area_hectare: float
    preferred_species: Optional[List[str]] = None
    exclude_species: Optional[List[str]] = None


class TEMEInput(BaseModel):
    emission_kg: float
    activity_breakdown: Dict[str, float] = Field(default_factory=dict)
    location: str = "India"
    start_year: int = 2026
    time_horizon_years: int = 20
    constraints: Constraints
    ml: Optional[MLConfig] = None


class OffsetPlanItem(BaseModel):
    species: str
    count: int
    annual_sequestration_kg: List[float]
    survival_curve: List[float]


class TEMEOutput(BaseModel):
    offset_plan: List[OffsetPlanItem]
    total_trees: int
    land_required_hectare: float
    time_to_neutral_years: int
    confidence_score: float
    warnings: List[str]
    ml_metadata: Optional[Dict[str, Any]] = None


@router.post("/run", response_model=TEMEOutput)
def run_teme_api(payload: TEMEInput):
    try:
        input_dict = payload.model_dump()
        constraints = input_dict.get("constraints", {})
        constraints["preferred_species"] = constraints.get("preferred_species") or []
        constraints["exclude_species"] = constraints.get("exclude_species") or []
        input_dict["ml"] = input_dict.get("ml") or {"enabled": False}
        return run_teme(input_dict)

    except InfeasiblePlanError as e:
        raise HTTPException(status_code=422, detail=f"Infeasible plan: {e}")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Input validation error: {e}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal TEME error: {e}")
