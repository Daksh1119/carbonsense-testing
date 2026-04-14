from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Dict, List, Optional, Any

from ml_services.api.teme_routes import router as teme_router
from ml_services.api.ocr_routes import router as ocr_router
from ml_services.api.recommendation_routes import router as recommendation_router
from ml_services.api.ingestion_routes import router as ingestion_router
from ml_services.api.policies_routes import router as policies_router
from ml_services.api.compliance_routes import router as compliance_router

app = FastAPI(
    title="CarbonSense ML Service",
    version="1.1.0",
    description="Time-based Ecological Mitigation Engine (TEME) + OCR APIs",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3001",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
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


# --- Mount routers ---
app.include_router(teme_router)
app.include_router(ocr_router)
app.include_router(recommendation_router)
app.include_router(ingestion_router)
app.include_router(policies_router)
app.include_router(compliance_router)
