"""
food/api.py
───────────
FastAPI router for food recognition endpoints.

Routes:
  POST /food/recognize          – single image prediction
  POST /food/cafeteria/menu     – admin pre-recognizes daily dishes once
  POST /food/cafeteria/log      – employee logs meal from pre-recognized menu
"""

from __future__ import annotations

import json as _json
import os
import tempfile
from pathlib import Path
from typing import List, Optional
from uuid import uuid4

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from ml_services.food.inference import predict_food
from ml_services.food.food_carbon_db import get_carbon
from ml_services.common.authz import ensure_user_in_org, ensure_permission

router = APIRouter(prefix="/food", tags=["Food Recognition"])

ALLOWED_EXT = {".jpg", ".jpeg", ".png", ".webp"}
MAX_MB = 10


# ─── Pydantic schemas ─────────────────────────────────────────────────────────

class FoodPrediction(BaseModel):
    rank: int
    food: str
    food_key: str
    confidence: float
    carbon_per_100g_kg: float
    source: Optional[str] = None


class FoodRecognitionResponse(BaseModel):
    success: bool
    top_prediction: Optional[str] = None
    food_key: Optional[str] = None
    carbon_per_100g_kg: Optional[float] = None
    predictions: List[FoodPrediction] = []
    model_used: Optional[str] = None
    serving_note: Optional[str] = None
    error: Optional[str] = None


class CafeteriaMenuItem(BaseModel):
    dish_name: str
    food_key: str
    carbon_per_100g_kg: float
    confidence: float
    image_filename: str


class CafeteriaMenuResponse(BaseModel):
    success: bool
    menu_id: str
    organization_id: str
    date: str
    location: str
    items: List[CafeteriaMenuItem]
    usage_instructions: str


class MealLogResponse(BaseModel):
    success: bool
    transaction_id: Optional[str] = None
    total_carbon_kg: float
    items: List[dict]
    comparison: dict


# ─── Helper ───────────────────────────────────────────────────────────────────

def _ext_ok(filename: str) -> bool:
    return Path(filename or "").suffix.lower() in ALLOWED_EXT


# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.post("/recognize", response_model=FoodRecognitionResponse)
async def recognize_food(
    file: UploadFile = File(...),
    user_id: str = Form(...),
    organization_id: str = Form(...),
    top_k: int = Form(default=5),
):
    """Recognize food from a single image and return carbon estimate."""
    ensure_user_in_org(user_id, organization_id)

    if not _ext_ok(file.filename or ""):
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type. Allowed: {sorted(ALLOWED_EXT)}",
        )

    blob = await file.read()
    if len(blob) > MAX_MB * 1024 * 1024:
        raise HTTPException(status_code=413, detail=f"File too large. Max {MAX_MB} MB.")

    suffix = Path(file.filename or "food.jpg").suffix or ".jpg"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp.write(blob)
        tmp_path = tmp.name

    try:
        result = predict_food(tmp_path, top_k=top_k)
        return JSONResponse(result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        os.unlink(tmp_path)


@router.post("/cafeteria/menu", response_model=CafeteriaMenuResponse)
async def create_cafeteria_menu(
    organization_id: str = Form(...),
    uploaded_by: str = Form(...),
    date: str = Form(...),
    location: str = Form(default="main_cafeteria"),
    files: List[UploadFile] = File(...),
):
    """
    Admin uploads photos of today's cafeteria dishes.
    System recognises them once and stores as the day's menu.
    Employees then select from this menu — no per-employee ML needed.
    """
    ensure_user_in_org(uploaded_by, organization_id)
    ensure_permission(uploaded_by, organization_id, "edit_emissions_data")

    menu_items: List[dict] = []

    for img_file in files:
        if not _ext_ok(img_file.filename or ""):
            continue

        blob   = await img_file.read()
        suffix = Path(img_file.filename or "dish.jpg").suffix or ".jpg"

        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            tmp.write(blob)
            tmp_path = tmp.name

        try:
            pred = predict_food(tmp_path, top_k=1)
            if pred["success"] and pred["predictions"]:
                top = pred["predictions"][0]
                menu_items.append({
                    "dish_name":          top["food"],
                    "food_key":           top["food_key"],
                    "carbon_per_100g_kg": top["carbon_per_100g_kg"],
                    "confidence":         top["confidence"],
                    "image_filename":     img_file.filename or "",
                })
        finally:
            os.unlink(tmp_path)

    return JSONResponse({
        "success":            True,
        "menu_id":            str(uuid4()),
        "organization_id":    organization_id,
        "date":               date,
        "location":           location,
        "items":              menu_items,
        "usage_instructions": "Employees select dishes from this menu when logging lunch.",
    })


@router.post("/cafeteria/log", response_model=MealLogResponse)
async def log_cafeteria_meal(
    user_id: str = Form(...),
    organization_id: str = Form(...),
    menu_id: str = Form(...),
    selections: str = Form(...),  # JSON: [{"dish_name":"Biryani","food_key":"biryani","serving_g":250}]
):
    """
    Employee logs meal by selecting from a pre-recognised cafeteria menu.
    No ML inference — pure lookup + carbon calculation.
    """
    ensure_user_in_org(user_id, organization_id)

    try:
        selected_dishes: List[dict] = _json.loads(selections)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid selections JSON.")

    total_carbon = 0.0
    meal_items:  List[dict] = []

    for sel in selected_dishes:
        food_key    = sel.get("food_key", sel.get("dish_name", "").lower().replace(" ", "_"))
        serving_g   = float(sel.get("serving_g", 100))
        carbon_100g = get_carbon(food_key)
        carbon_item = carbon_100g * (serving_g / 100)
        total_carbon += carbon_item
        meal_items.append({
            "dish":      sel.get("dish_name", food_key),
            "food_key":  food_key,
            "serving_g": serving_g,
            "carbon_kg": round(carbon_item, 4),
        })

    from packages.ml_services.ocr.carbon_comparisons import build_comparisons
    return JSONResponse({
        "success":         True,
        "transaction_id":  str(uuid4()),
        "total_carbon_kg": round(total_carbon, 4),
        "items":           meal_items,
        "comparison":      build_comparisons(total_carbon),
    })
