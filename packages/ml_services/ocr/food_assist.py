from __future__ import annotations

import os
from typing import Dict, List, Any


def _enabled() -> bool:
    return os.getenv("OCR_ENABLE_FOOD101_ASSIST", "false").strip().lower() == "true"


def _min_conf() -> float:
    try:
        return float(os.getenv("OCR_FOOD101_MIN_CONF", "0.80"))
    except ValueError:
        return 0.80


def _max_ocr_conf() -> float:
    try:
        return float(os.getenv("OCR_FOOD101_MAX_OCR_CONF", "0.75"))
    except ValueError:
        return 0.75


def _unknown_ratio(mapped_items: List[Dict[str, Any]]) -> float:
    if not mapped_items:
        return 1.0
    unknown = sum(1 for i in mapped_items if i.get("category") == "unknown")
    return unknown / max(len(mapped_items), 1)


def _recompute_total(mapped_items: List[Dict[str, Any]]) -> float:
    total = 0.0
    for item in mapped_items:
        total += float(item.get("carbon_kg", 0.0))
    return round(total, 4)


def _pick_unknown_item_index(mapped_items: List[Dict[str, Any]]) -> int | None:
    candidates = []
    for idx, item in enumerate(mapped_items):
        if item.get("category") == "unknown":
            amount = float(item.get("amount", 0.0) or 0.0)
            candidates.append((idx, amount))
    if not candidates:
        return None
    candidates.sort(key=lambda x: x[1], reverse=True)
    return candidates[0][0]


def apply_food101_assist(
    *,
    file_path: str,
    is_pdf: bool,
    ocr_confidence: float,
    mapped_items: List[Dict[str, Any]],
) -> Dict[str, Any]:
    """
    Optional Food101-assisted mapping for low-confidence OCR receipts.

    This function is intentionally conservative:
    - Fully disabled by default (OCR_ENABLE_FOOD101_ASSIST=false)
    - Applies only on image receipts (not PDFs)
    - Applies only when OCR is weak or unknown mapping is high
    - Requires strong model confidence before changing mapped items
    """
    base = {
        "enabled": _enabled(),
        "triggered": False,
        "applied": False,
        "reason": None,
        "prediction": None,
    }

    if not base["enabled"]:
        base["reason"] = "feature_disabled"
        return {
            "assist": base,
            "mapped_items": mapped_items,
            "total_carbon_kg": _recompute_total(mapped_items),
        }

    if is_pdf:
        base["reason"] = "pdf_not_supported"
        return {
            "assist": base,
            "mapped_items": mapped_items,
            "total_carbon_kg": _recompute_total(mapped_items),
        }

    unknown_ratio = _unknown_ratio(mapped_items)
    low_conf = ocr_confidence < _max_ocr_conf()
    mostly_unknown = unknown_ratio >= 0.5
    empty_items = len(mapped_items) == 0

    if not (low_conf or mostly_unknown or empty_items):
        base["reason"] = "ocr_and_mapping_confident"
        return {
            "assist": base,
            "mapped_items": mapped_items,
            "total_carbon_kg": _recompute_total(mapped_items),
        }

    base["triggered"] = True

    try:
        from ml_services.food.inference import predict_food

        pred = predict_food(file_path, top_k=3)
        if not pred.get("success"):
            base["reason"] = f"food_model_failed: {pred.get('error', 'unknown')}"
            return {
                "assist": base,
                "mapped_items": mapped_items,
                "total_carbon_kg": _recompute_total(mapped_items),
            }

        top_pred = (pred.get("predictions") or [{}])[0]
        top_conf = float(top_pred.get("confidence", 0.0) or 0.0)
        carbon_per_100g = float(top_pred.get("carbon_per_100g_kg", 0.0) or 0.0)
        food_name = str(top_pred.get("food", "Unknown Food"))
        food_key = str(top_pred.get("food_key", "unknown_food"))

        base["prediction"] = {
            "food": food_name,
            "food_key": food_key,
            "confidence": round(top_conf, 4),
            "carbon_per_100g_kg": carbon_per_100g,
            "model_used": pred.get("model_used"),
        }

        if top_conf < _min_conf():
            base["reason"] = "food_prediction_below_threshold"
            return {
                "assist": base,
                "mapped_items": mapped_items,
                "total_carbon_kg": _recompute_total(mapped_items),
            }

        updated = list(mapped_items)

        # Rule: apply only to unknown items or empty item lists.
        idx = _pick_unknown_item_index(updated)
        if idx is not None:
            qty = float(updated[idx].get("quantity", 1) or 1)
            updated[idx]["category"] = "food_ml_assisted"
            updated[idx]["name"] = updated[idx].get("name") or food_name
            updated[idx]["ml_food_key"] = food_key
            updated[idx]["ml_food_confidence"] = round(top_conf, 4)
            updated[idx]["carbon_kg"] = round(carbon_per_100g * qty, 4)
            base["applied"] = True
            base["reason"] = "updated_unknown_item"
        elif empty_items:
            updated.append(
                {
                    "name": food_name,
                    "amount": 0.0,
                    "quantity": 1.0,
                    "category": "food_ml_assisted",
                    "carbon_kg": round(carbon_per_100g, 4),
                    "ml_food_key": food_key,
                    "ml_food_confidence": round(top_conf, 4),
                }
            )
            base["applied"] = True
            base["reason"] = "created_item_from_food_prediction"
        else:
            base["reason"] = "no_unknown_item_to_update"

        return {
            "assist": base,
            "mapped_items": updated,
            "total_carbon_kg": _recompute_total(updated),
        }

    except Exception as e:
        base["reason"] = f"assist_exception: {type(e).__name__}: {e}"
        return {
            "assist": base,
            "mapped_items": mapped_items,
            "total_carbon_kg": _recompute_total(mapped_items),
        }
