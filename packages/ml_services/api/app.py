from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from typing import Dict, List, Optional, Any

from ml_services.api.teme_routes import router as teme_router
from ml_services.api.ocr_routes import router as ocr_router

app = FastAPI(
    title="CarbonSense ML Service",
    version="1.1.0",
    description="Time-based Ecological Mitigation Engine (TEME) + OCR APIs",
)


# --- Request/Response Schemas (TEME) ---

class MLConfig(BaseModel):
    enabled: bool = False


class Constraints(BaseModel):
    max_land_area_hectare: float
    preferred_species: Optional[List[str]] = None
    exclude_species: Optional[List[str]] = None


class TEMEInput(BaseModel):
    emission_kg: float
    activity_breakdown: Dict[str, float] = Field(
        default_factory=dict,
        description="Sector-wise emission split (for explainability only)",
    )
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


# --- Health Endpoint ---

@app.get("/health")
def health():
    return {"status": "ok", "service": "carbonsense-ml"}


# --- TEME Endpoint ---

@app.post("/teme/run", response_model=TEMEOutput)
def run_teme_api(payload: TEMEInput):
    """Execute TEME using rule-based optimization."""
    try:
        input_dict = payload.model_dump()

        # Normalize constraints: convert None to [] for list fields
        constraints = input_dict.get("constraints", {})
        if constraints.get("preferred_species") is None:
            constraints["preferred_species"] = []
        if constraints.get("exclude_species") is None:
            constraints["exclude_species"] = []

        # Normalize ml config: convert None to {"enabled": false}
        if input_dict.get("ml") is None:
            input_dict["ml"] = {"enabled": False}

        print(
            f"[TEME API] Received request: emission_kg={input_dict['emission_kg']}, "
            f"location={input_dict['location']}, "
            f"time_horizon={input_dict['time_horizon_years']} years, "
            f"ml_enabled={input_dict['ml']['enabled']}"
        )

        result = run_teme(input_dict)

        print(
            f"[TEME API] Success: {result['total_trees']} trees, "
            f"neutrality in {result['time_to_neutral_years']} years, "
            f"confidence={result['confidence_score']}, "
            f"ml_active={result.get('ml_metadata', {}).get('enabled', False)}"
        )

        return result

    except InfeasiblePlanError as e:
        print(f"[TEME API] Infeasible plan: {e}")
        raise HTTPException(status_code=422, detail=f"Infeasible plan: {e}")

    except ValueError as e:
        print(f"[TEME API] Validation error: {e}")
        raise HTTPException(status_code=400, detail=f"Input validation error: {e}")

    except TypeError as e:
        print(f"[TEME API] Type error: {e}")
        raise HTTPException(status_code=500, detail=f"Internal TEME error: {e}")

    except KeyError as e:
        print(f"[TEME API] Missing key: {e}")
        raise HTTPException(status_code=500, detail=f"Missing configuration key: {e}")

    except Exception as e:
        print(f"[TEME API] Unexpected error: {type(e).__name__}: {e}")
        raise HTTPException(status_code=500, detail=f"Internal TEME error: {e}")


# --- Mount OCR routes under /ocr/* ---
app.include_router(ocr_router)
