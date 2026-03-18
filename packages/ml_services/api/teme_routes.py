from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Dict, List, Optional, Any

from ml_services.teme.core.engine import run_teme
from ml_services.teme.core.exceptions import InfeasiblePlanError

router = APIRouter(prefix="/teme", tags=["TEME"])

_LOCATION_MAP = {
    # --- Broad region aliases ---
    "india": "India",
    "india_tropical": "India_tropical",
    "india_arid": "India_arid",
    "india_subtropical": "India_subtropical",
    "india_semi_arid": "India_semi_arid",
    "india_coastal": "India_coastal",
    "india_himalayan": "India_himalayan",
    "india_northeastern": "India_northeastern",
    # --- States: Tropical belt ---
    "maharashtra": "India_tropical",
    "karnataka": "India_tropical",
    "tamil nadu": "India_tropical",
    "tamilnadu": "India_tropical",
    "west bengal": "India_tropical",
    "westbengal": "India_tropical",
    "andhra pradesh": "India_tropical",
    "andhrapradesh": "India_tropical",
    "odisha": "India_tropical",
    "orissa": "India_tropical",
    "chhattisgarh": "India_tropical",
    "jharkhand": "India_tropical",
    "nagpur": "India_tropical",
    "surat": "India_tropical",
    "coimbatore": "India_tropical",
    "kolkata": "India_tropical",
    "bangalore": "India_tropical",
    "bengaluru": "India_tropical",
    "banglore": "India_tropical",
    "chennai": "India_tropical",
    "bhubaneswar": "India_tropical",
    "raipur": "India_tropical",
    "ranchi": "India_tropical",
    "vizag": "India_tropical",
    "visakhapatnam": "India_tropical",
    # --- States: Semi-arid Deccan ---
    "telangana": "India_semi_arid",
    "hyderabad": "India_semi_arid",
    "pune": "India_semi_arid",
    # --- States: Arid zones ---
    "gujarat": "India_arid",
    "rajasthan": "India_arid",
    "jaipur": "India_arid",
    "ahmedabad": "India_arid",
    "jodhpur": "India_arid",
    # --- States: Coastal ---
    "kerala": "India_coastal",
    "goa": "India_coastal",
    "mumbai": "India_coastal",
    "kochi": "India_coastal",
    "thiruvananthapuram": "India_coastal",
    "trivandrum": "India_coastal",
    "mangalore": "India_coastal",
    "mangaluru": "India_coastal",
    # --- States: Subtropical plains ---
    "delhi ncr": "India_subtropical",
    "delhi": "India_subtropical",
    "uttar pradesh": "India_subtropical",
    "uttarpradesh": "India_subtropical",
    "madhya pradesh": "India_subtropical",
    "madhyapradesh": "India_subtropical",
    "bihar": "India_subtropical",
    "punjab": "India_subtropical",
    "haryana": "India_subtropical",
    "chandigarh": "India_subtropical",
    "lucknow": "India_subtropical",
    "bhopal": "India_subtropical",
    "indore": "India_subtropical",
    "patna": "India_subtropical",
    "agra": "India_subtropical",
    "varanasi": "India_subtropical",
    "kanpur": "India_subtropical",
    # --- States: Himalayan ---
    "himachal pradesh": "India_himalayan",
    "himachalpradesh": "India_himalayan",
    "uttarakhand": "India_himalayan",
    "jammu and kashmir": "India_himalayan",
    "jammu": "India_himalayan",
    "kashmir": "India_himalayan",
    "ladakh": "India_himalayan",
    "sikkim": "India_himalayan",
    "dehradun": "India_himalayan",
    "shimla": "India_himalayan",
    "srinagar": "India_himalayan",
    "mussoorie": "India_himalayan",
    # --- States: Northeastern ---
    "assam": "India_northeastern",
    "meghalaya": "India_northeastern",
    "nagaland": "India_northeastern",
    "manipur": "India_northeastern",
    "tripura": "India_northeastern",
    "mizoram": "India_northeastern",
    "arunachal pradesh": "India_northeastern",
    "arunachalpradesh": "India_northeastern",
    "guwahati": "India_northeastern",
    "shillong": "India_northeastern",
    "imphal": "India_northeastern",
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
    project_goal: Optional[str] = None  # fastest_offset | lowest_cost | drought_resilient | native_species | biodiversity
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
