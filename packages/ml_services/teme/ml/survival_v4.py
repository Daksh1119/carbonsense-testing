"""
TEME v4 runtime survival predictor.

Loads the artifact bundle produced by scripts/train_teme_survival_v4.py and
exposes a single prediction function returning a point estimate, an
uncertainty band, and the resolved model version -- all computed from the
single ExtraTrees model already in the bundle (no separate quantile models).
"""

from __future__ import annotations

from typing import Any

import numpy as np
import pandas as pd

from ml_services.teme.ml.features_v4 import build_features_v4


def _build_inference_row(
    growth_rate_class: float,
    drought_score: float,
    fire_score: float,
    disease_score: float,
    planted_count: float,
) -> pd.DataFrame:
    return pd.DataFrame([{
        "growth_rate_class": growth_rate_class,
        "drought_score": drought_score,
        "fire_score": fire_score,
        "disease_score": disease_score,
        "planted_count": planted_count,
    }])


def _tree_variance_uncertainty(model, X: np.ndarray) -> dict[str, float]:
    """
    Query every tree in the ensemble individually and take percentiles
    across their predictions. Free uncertainty estimate -- no separate
    quantile models needed.
    """
    tree_preds = np.array([t.predict(X) for t in model.estimators_])  # (n_trees, n_samples)
    return {
        "p10": float(np.percentile(tree_preds, 10, axis=0)[0]),
        "p50": float(np.percentile(tree_preds, 50, axis=0)[0]),
        "p90": float(np.percentile(tree_preds, 90, axis=0)[0]),
    }


def predict_v4(
    bundle: dict[str, Any],
    growth_rate_class: float,
    drought_score: float,
    fire_score: float,
    disease_score: float,
    planted_count: float,
    species_name: str | None = None,
    explain: bool = False,
) -> dict[str, Any]:
    """
    Returns:
        {
            "point": float,               # calibrated point prediction, clipped [0,1]
            "p10": float, "p90": float,   # uncertainty band from tree spread
            "model_version": str,
            "calibrated": bool,
            "explanation": Optional[dict], # only populated if explain=True and SHAP available
        }
    """
    model = bundle["model_point"]
    feature_cols = bundle["feature_cols"]
    species_map = bundle.get("species_map", {})
    global_mean = bundle.get("global_mean", 0.5)
    calibrator = bundle.get("calibrator")
    metadata = bundle.get("metadata", {})

    raw_row = _build_inference_row(
        growth_rate_class, drought_score, fire_score, disease_score, planted_count
    )
    features = build_features_v4(raw_row)

    species_key = str(species_name).lower().strip() if species_name else "unknown"
    features["species_target_enc"] = species_map.get(species_key, global_mean)

    # Align exactly to training-time feature ordering; anything the model
    # doesn't expect (or is missing) gets a neutral 0.0 rather than crashing.
    X = pd.DataFrame(index=features.index)
    for col in feature_cols:
        if col in features.columns:
            X[col] = pd.to_numeric(features[col], errors="coerce")
        else:
            X[col] = 0.0
    X = X.fillna(0.0).to_numpy()

    point_raw = float(model.predict(X)[0])
    uncertainty = _tree_variance_uncertainty(model, X)

    calibrated = False
    point = point_raw
    if calibrator is not None:
        try:
            point = float(calibrator.predict([point_raw])[0])
            calibrated = True
        except Exception:
            # calibration failure must never break prediction
            point = point_raw

    point = max(0.0, min(1.0, point))

    result: dict[str, Any] = {
        "point": point,
        "p10": max(0.0, min(1.0, uncertainty["p10"])),
        "p90": max(0.0, min(1.0, uncertainty["p90"])),
        "model_version": metadata.get("version", "teme-survival-v4-unknown"),
        "calibrated": calibrated,
        "explanation": None,
    }

    if explain and bundle.get("shap_explainer") is not None:
        try:
            shap_values = bundle["shap_explainer"].shap_values(X)
            result["explanation"] = {
                col: float(val)
                for col, val in zip(feature_cols, np.array(shap_values)[0])
            }
        except Exception:
            result["explanation"] = None  # explanation failure must never break prediction

    return result
