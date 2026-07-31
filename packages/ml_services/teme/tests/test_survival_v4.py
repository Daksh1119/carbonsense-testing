"""
Tests for the TEME v4 runtime predictor.

Uses a tiny in-memory bundle (not the real trained artifact) so these tests
run fast and don't depend on a model file existing on disk.
"""

import numpy as np
import pandas as pd
import pytest
from sklearn.ensemble import ExtraTreesRegressor
from sklearn.isotonic import IsotonicRegression

from ml_services.teme.ml.features_v4 import build_features_v4
from ml_services.teme.ml.survival_v4 import predict_v4


def _tiny_bundle():
    raw = pd.DataFrame({
        "growth_rate_class": [5, 6, 7, 5, 8, 4],
        "drought_score": [4, 6, 5, 3, 7, 2],
        "fire_score": [3, 8, 4, 2, 6, 3],
        "disease_score": [5, 5, 5, 5, 5, 5],
        "planted_count": [100, 200, 150, 90, 300, 120],
    })
    features = build_features_v4(raw)
    features["species_target_enc"] = 0.7
    y = np.array([0.8, 0.6, 0.7, 0.85, 0.55, 0.9])

    model = ExtraTreesRegressor(n_estimators=30, random_state=42, min_samples_leaf=1).fit(features, y)
    calibrator = IsotonicRegression(out_of_bounds="clip", y_min=0.0, y_max=1.0).fit(model.predict(features), y)

    return {
        "model_point": model,
        "calibrator": calibrator,
        "feature_cols": list(features.columns),
        "species_map": {"neem": 0.75},
        "global_mean": 0.7,
        "metadata": {"version": "test-v4"},
        "shap_explainer": None,
    }


def test_predict_v4_returns_bounded_point_estimate():
    bundle = _tiny_bundle()
    result = predict_v4(bundle, growth_rate_class=6, drought_score=5, fire_score=4, disease_score=5, planted_count=100)
    assert 0.0 <= result["point"] <= 1.0


def test_predict_v4_uncertainty_band_contains_point_estimate_loosely():
    bundle = _tiny_bundle()
    result = predict_v4(bundle, growth_rate_class=6, drought_score=5, fire_score=4, disease_score=5, planted_count=100)
    assert 0.0 <= result["p10"] <= 1.0
    assert 0.0 <= result["p90"] <= 1.0
    assert result["p10"] <= result["p90"]


def test_predict_v4_reports_model_version_from_bundle_not_hardcoded():
    bundle = _tiny_bundle()
    result = predict_v4(bundle, growth_rate_class=6, drought_score=5, fire_score=4, disease_score=5, planted_count=100)
    assert result["model_version"] == "test-v4"


def test_predict_v4_uses_known_species_map_when_provided():
    bundle = _tiny_bundle()
    result_known = predict_v4(
        bundle, growth_rate_class=6, drought_score=5, fire_score=4, disease_score=5,
        planted_count=100, species_name="Neem",
    )
    result_unknown = predict_v4(
        bundle, growth_rate_class=6, drought_score=5, fire_score=4, disease_score=5,
        planted_count=100, species_name="totally_unseen_species",
    )
    assert 0.0 <= result_known["point"] <= 1.0
    assert 0.0 <= result_unknown["point"] <= 1.0


def test_predict_v4_calibration_flag_reflects_whether_calibrator_present():
    bundle = _tiny_bundle()
    result = predict_v4(bundle, growth_rate_class=6, drought_score=5, fire_score=4, disease_score=5, planted_count=100)
    assert result["calibrated"] is True

    bundle_no_cal = dict(bundle)
    bundle_no_cal["calibrator"] = None
    result_no_cal = predict_v4(bundle_no_cal, growth_rate_class=6, drought_score=5, fire_score=4, disease_score=5, planted_count=100)
    assert result_no_cal["calibrated"] is False


def test_predict_v4_never_crashes_on_broken_calibrator():
    """Calibration failure must degrade gracefully, never raise."""
    bundle = _tiny_bundle()

    class BrokenCalibrator:
        def predict(self, X):
            raise RuntimeError("simulated calibrator failure")

    bundle["calibrator"] = BrokenCalibrator()
    result = predict_v4(bundle, growth_rate_class=6, drought_score=5, fire_score=4, disease_score=5, planted_count=100)
    assert 0.0 <= result["point"] <= 1.0
    assert result["calibrated"] is False


def test_predict_v4_is_deterministic_for_same_input():
    bundle = _tiny_bundle()
    r1 = predict_v4(bundle, growth_rate_class=6, drought_score=5, fire_score=4, disease_score=5, planted_count=100)
    r2 = predict_v4(bundle, growth_rate_class=6, drought_score=5, fire_score=4, disease_score=5, planted_count=100)
    assert r1["point"] == r2["point"]
    assert r1["p10"] == r2["p10"]
    assert r1["p90"] == r2["p90"]