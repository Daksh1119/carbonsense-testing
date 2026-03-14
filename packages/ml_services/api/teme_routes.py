from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Dict, List, Optional, Any

from ml_services.teme.core.engine import run_teme
from ml_services.teme.core.exceptions import InfeasiblePlanError

router = APIRouter(prefix="/teme", tags=["TEME"])

_LOCATION_MAP = {
    "india": "India",
    "maharashtra": "India_tropical",
    "karnataka": "India_tropical",
    "tamil nadu": "India_tropical",
    "west bengal": "India_tropical",
    "gujarat": "India_arid",
    "rajasthan": "India_arid",
    "delhi ncr": "India_subtropical",
    "uttar pradesh": "India_subtropical",
}


class MLConfig(BaseModel):
    enabled: bool = False


class MLCompatibilityConfig(BaseModel):
    enable_monte_carlo: bool = False
    monte_carlo_trials: int = 300


class Constraints(BaseModel):
    max_land_area_hectare: float
    preferred_species: Optional[List[str]] = None
    exclude_species: Optional[List[str]] = None
    time_horizon_years: Optional[int] = None


class TEMEInput(BaseModel):
    emission_kg: float
    activity_breakdown: Dict[str, float] = Field(default_factory=dict)
    location: str = "India"
    start_year: int = 2026
    time_horizon_years: int = 20
    project_name: Optional[str] = None
    constraints: Constraints
    ml: Optional[MLConfig] = None
    ml_config: Optional[MLCompatibilityConfig] = None


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
    monte_carlo: Optional[Dict[str, Any]] = None


@router.post("/run", response_model=TEMEOutput)
def run_teme_api(payload: TEMEInput):
    try:
        input_dict = payload.model_dump()
        constraints = input_dict.get("constraints", {})
        constraints["preferred_species"] = constraints.get("preferred_species") or []
        constraints["exclude_species"] = constraints.get("exclude_species") or []

        # Frontend compatibility: allow time horizon inside constraints.
        if constraints.get("time_horizon_years"):
            input_dict["time_horizon_years"] = constraints["time_horizon_years"]

        normalized_location = _LOCATION_MAP.get(str(input_dict.get("location", "India")).strip().lower())
        if normalized_location:
            input_dict["location"] = normalized_location

        input_dict["ml"] = input_dict.get("ml") or {"enabled": False}

        ml_config = input_dict.pop("ml_config", None) or {}
        if ml_config.get("enable_monte_carlo"):
            input_dict["monte_carlo"] = {
                "enabled": True,
                "n_simulations": ml_config.get("monte_carlo_trials", 300),
            }

        return run_teme(input_dict)

    except InfeasiblePlanError as e:
        raise HTTPException(status_code=422, detail=f"Infeasible plan: {e}")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Input validation error: {e}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal TEME error: {e}")
