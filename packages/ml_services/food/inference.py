"""
inference.py
────────────
Food recognition inference for CarbonSense.

Loads EfficientNet-B4 checkpoints (Food-101 + optional Indian fine-tune)
and returns top-k predictions with carbon estimates.

Model files expected at:
  models/food_recognition/food101_best.pt
  models/food_recognition/food101_classes.json
  models/food_recognition/indian_food_best.pt      (optional)
  models/food_recognition/indian_food_classes.json (optional)
"""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Dict, List, Optional

import torch
import torch.nn as nn
import torch.nn.functional as F
from PIL import Image, UnidentifiedImageError
from torchvision import models, transforms

from ml_services.food.food_carbon_db import get_carbon

DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")


def _resolve_model_dir() -> Path:
    """
    Resolve model directory robustly.

    Priority:
      1) FOOD_MODEL_DIR env override
      2) models/food_recognition (preferred structure)
      3) models/ (fallback for flat uploads)
    """
    env_dir = os.getenv("FOOD_MODEL_DIR")
    if env_dir:
        return Path(env_dir)

    preferred = Path("models/food_recognition")
    if (preferred / "food101_best.pt").exists() and (preferred / "food101_classes.json").exists():
        return preferred

    fallback = Path("models")
    if (fallback / "food101_best.pt").exists() and (fallback / "food101_classes.json").exists():
        return fallback

    # Default for first-time training environments
    return preferred


MODEL_DIR = _resolve_model_dir()

# ─── Inference-time transform (no augmentation) ──────────────────────────────
_INFER_TRANSFORM = transforms.Compose([
    transforms.Resize(430),
    transforms.CenterCrop(380),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406],
                         std=[0.229, 0.224, 0.225]),
])

# ─── Module-level model cache (loaded once, reused per process) ──────────────
_food101_model: Optional[nn.Module] = None
_food101_classes: Optional[List[str]] = None
_indian_model: Optional[nn.Module] = None
_indian_classes: Optional[List[str]] = None


def _build_efficientnet(num_classes: int) -> nn.Module:
    model = models.efficientnet_b4(weights=None)
    in_features = model.classifier[1].in_features
    model.classifier = nn.Sequential(
        nn.Dropout(p=0.4, inplace=True),
        nn.Linear(in_features, num_classes),
    )
    return model


def _load_food101() -> tuple[nn.Module, List[str]]:
    global _food101_model, _food101_classes

    if _food101_model is not None:
        return _food101_model, _food101_classes  # type: ignore[return-value]

    classes_path = MODEL_DIR / "food101_classes.json"
    ckpt_path    = MODEL_DIR / "food101_best.pt"

    if not ckpt_path.exists():
        raise FileNotFoundError(
            f"Food-101 checkpoint not found at {ckpt_path}. "
            "Train the model first: see scripts/train_food101.py"
        )

    with open(classes_path) as f:
        classes = json.load(f)

    model = _build_efficientnet(len(classes))
    ckpt  = torch.load(ckpt_path, map_location=DEVICE)
    model.load_state_dict(ckpt["model_state_dict"])
    model.eval().to(DEVICE)

    _food101_model   = model
    _food101_classes = classes
    return model, classes


def _load_indian() -> Optional[tuple[nn.Module, List[str]]]:
    global _indian_model, _indian_classes

    if _indian_model is not None:
        return _indian_model, _indian_classes  # type: ignore[return-value]

    ckpt_path    = MODEL_DIR / "indian_food_best.pt"
    classes_path = MODEL_DIR / "indian_food_classes.json"

    if not ckpt_path.exists():
        return None  # Indian model is optional

    with open(classes_path) as f:
        data    = json.load(f)
        classes = data["classes"] if isinstance(data, dict) else data

    model = _build_efficientnet(len(classes))
    ckpt  = torch.load(ckpt_path, map_location=DEVICE)
    model.load_state_dict(ckpt["model_state_dict"])
    model.eval().to(DEVICE)

    _indian_model   = model
    _indian_classes = classes
    return model, classes


def predict_food(image_path: str, top_k: int = 5) -> Dict:
    """
    Predict food class from an image file.

    Returns:
        {
          "success": bool,
          "top_prediction": str,
          "carbon_per_100g_kg": float,
          "predictions": [
              {"rank": 1, "food": "Biryani", "food_key": "biryani",
               "confidence": 0.87, "carbon_per_100g_kg": 0.75},
              ...
          ],
          "serving_note": str,
          "model_used": str,
          "error": str  (only on failure)
        }
    """
    if not os.path.exists(image_path):
        return {
            "success": False,
            "error": f"File not found: {image_path}",
            "predictions": [],
            "top_prediction": None,
            "carbon_per_100g_kg": 0.0,
        }

    try:
        image  = Image.open(image_path).convert("RGB")
        tensor = _INFER_TRANSFORM(image).unsqueeze(0).to(DEVICE)
    except UnidentifiedImageError:
        return {
            "success": False,
            "error": "Invalid or unsupported image format.",
            "predictions": [],
            "top_prediction": None,
            "carbon_per_100g_kg": 0.0,
        }
    except Exception as e:
        return {
            "success": False,
            "error": f"Image load failed: {e}",
            "predictions": [],
            "top_prediction": None,
            "carbon_per_100g_kg": 0.0,
        }

    try:
        food101_model, food101_classes = _load_food101()
    except FileNotFoundError as e:
        return {
            "success": False,
            "error": str(e),
            "predictions": [],
            "top_prediction": None,
            "carbon_per_100g_kg": 0.0,
        }

    with torch.no_grad():
        # ── Food-101 inference ───────────────────────────────────────────────
        logits_101 = food101_model(tensor)
        probs_101  = F.softmax(logits_101, dim=1)[0]
        top_probs, top_idxs = probs_101.topk(min(top_k, len(food101_classes)))

        predictions: List[Dict] = []
        for prob, idx in zip(top_probs.tolist(), top_idxs.tolist()):
            food_key  = food101_classes[idx]
            food_name = food_key.replace("_", " ").title()
            predictions.append({
                "rank":               len(predictions) + 1,
                "food":               food_name,
                "food_key":           food_key,
                "confidence":         round(prob, 4),
                "carbon_per_100g_kg": get_carbon(food_key),
            })

        # ── Optional Indian food override ────────────────────────────────────
        model_used    = "food101"
        indian_result = _load_indian()
        if indian_result is not None:
            indian_model, indian_classes = indian_result
            logits_ind   = indian_model(tensor)
            probs_ind    = F.softmax(logits_ind, dim=1)[0]
            top_ind_prob = probs_ind.max().item()
            top_ind_idx  = probs_ind.argmax().item()

            # Override only when Indian model is clearly more confident
            if top_ind_prob > predictions[0]["confidence"] * 1.1:
                food_key  = indian_classes[top_ind_idx]
                food_name = food_key.replace("_", " ").title()
                predictions.insert(0, {
                    "rank":               0,
                    "food":               food_name,
                    "food_key":           food_key,
                    "confidence":         round(top_ind_prob, 4),
                    "carbon_per_100g_kg": get_carbon(food_key),
                    "source":             "indian_model",
                })
                model_used = "indian_food"

    top = predictions[0]

    return {
        "success":            True,
        "top_prediction":     top["food"],
        "food_key":           top["food_key"],
        "carbon_per_100g_kg": top["carbon_per_100g_kg"],
        "predictions":        predictions[:top_k],
        "model_used":         model_used,
        "serving_note":       "Multiply by (actual_grams / 100) for full portion carbon.",
    }
