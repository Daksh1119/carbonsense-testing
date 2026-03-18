import os
import sys
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parents[2]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))
PACKAGES_DIR = ROOT_DIR / "packages"
if str(PACKAGES_DIR) not in sys.path:
    sys.path.insert(0, str(PACKAGES_DIR))

from packages.ml_services.ocr.food_assist import apply_food101_assist


def test_food_assist_disabled_by_default(monkeypatch):
    monkeypatch.delenv("OCR_ENABLE_FOOD101_ASSIST", raising=False)

    out = apply_food101_assist(
        file_path="dummy.jpg",
        is_pdf=False,
        ocr_confidence=0.40,
        mapped_items=[{"name": "Unknown Item", "category": "unknown", "carbon_kg": 0.0}],
    )

    assert out["assist"]["enabled"] is False
    assert out["assist"]["applied"] is False


def test_food_assist_updates_unknown_item(monkeypatch):
    monkeypatch.setenv("OCR_ENABLE_FOOD101_ASSIST", "true")
    monkeypatch.setenv("OCR_FOOD101_MIN_CONF", "0.80")

    def _fake_predict_food(_path, top_k=3):
        return {
            "success": True,
            "predictions": [
                {
                    "food": "Chicken Curry",
                    "food_key": "chicken_curry",
                    "confidence": 0.93,
                    "carbon_per_100g_kg": 1.5,
                }
            ],
            "model_used": "food101",
        }

    import packages.ml_services.ocr.food_assist as assist_mod
    monkeypatch.setattr(assist_mod, "_enabled", lambda: True)

    # monkeypatch module import target
    import types
    fake_module = types.SimpleNamespace(predict_food=_fake_predict_food)
    monkeypatch.setitem(sys.modules, "ml_services.food.inference", fake_module)

    out = apply_food101_assist(
        file_path="receipt.png",
        is_pdf=False,
        ocr_confidence=0.30,
        mapped_items=[
            {"name": "ITEM A", "amount": 120.0, "quantity": 1.0, "category": "unknown", "carbon_kg": 0.0}
        ],
    )

    assert out["assist"]["triggered"] is True
    assert out["assist"]["applied"] is True
    assert out["mapped_items"][0]["category"] == "food_ml_assisted"
    assert out["mapped_items"][0]["carbon_kg"] == 1.5


def test_food_assist_not_applied_for_pdf(monkeypatch):
    monkeypatch.setenv("OCR_ENABLE_FOOD101_ASSIST", "true")

    out = apply_food101_assist(
        file_path="receipt.pdf",
        is_pdf=True,
        ocr_confidence=0.20,
        mapped_items=[{"name": "Unknown", "category": "unknown", "carbon_kg": 0.0}],
    )

    assert out["assist"]["triggered"] is False
    assert out["assist"]["applied"] is False
    assert out["assist"]["reason"] == "pdf_not_supported"
