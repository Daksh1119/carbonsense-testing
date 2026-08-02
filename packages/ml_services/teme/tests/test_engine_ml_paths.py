"""
Integration tests for engine.py's three ML paths:
  1. ML disabled entirely -- must still produce a valid deterministic plan
  2. ML enabled, legacy model only present -- must report the REAL resolved
     version (not the old hardcoded "rf-survival-v1.1" string)
  3. ML enabled with prefer_v4=True but v4 artifact missing -- must fall
     back to legacy silently, never crash
  4. ML enabled with prefer_v4=True and v4 artifact present -- must use v4,
     report its real version string, and populate uncertainty

Uses temporary model directories (monkeypatched) so this never depends on
real trained artifacts existing on disk -- safe to run in CI.
"""

import joblib
import numpy as np
import pandas as pd
import pytest
from sklearn.ensemble import ExtraTreesRegressor
from sklearn.isotonic import IsotonicRegression

import ml_services.teme.ml.survival as survival_module
from ml_services.teme.core.engine import run_teme
from ml_services.teme.ml.features_v4 import build_features_v4


BASE_PAYLOAD = {
    "emission_kg": 500,
    "time_horizon_years": 20,
    "location": "India",
    "constraints": {"max_land_area_hectare": 5.0},
}


@pytest.fixture(autouse=True)
def reset_model_state():
    """Every test starts with a clean, unloaded model cache."""
    survival_module._state.update(
        model=None, model_kind=None, model_version=None, resolved_path=None, last_uncertainty=None
    )
    yield
    survival_module._state.update(
        model=None, model_kind=None, model_version=None, resolved_path=None, last_uncertainty=None
    )


@pytest.fixture
def legacy_model_dir(tmp_path, monkeypatch):
    """A tmp dir containing only a legacy pickle model."""
    model_dir = tmp_path / "models"
    model_dir.mkdir()
    X = np.random.rand(50, 5) * 10
    y = np.clip(0.7 + np.random.randn(50) * 0.05, 0, 1)
    from sklearn.ensemble import RandomForestRegressor
    legacy_model = RandomForestRegressor(n_estimators=10, random_state=42).fit(X, y)
    joblib.dump(legacy_model, model_dir / "rf_survival_v1_2.pkl")

    monkeypatch.setattr(survival_module, "MODEL_DIR", model_dir)
    monkeypatch.setattr(survival_module, "V4_ARTIFACT_CANDIDATES", [model_dir / "teme_survival_v4.joblib"])
    monkeypatch.setattr(
        survival_module, "LEGACY_MODEL_CANDIDATES",
        [model_dir / "rf_survival_v1_2.pkl", model_dir / "rf_survival_v1_1.pkl"],
    )
    return model_dir


@pytest.fixture
def legacy_and_v4_model_dir(legacy_model_dir):
    """Same dir, but now also has a real v4 bundle."""
    raw = pd.DataFrame({
        "growth_rate_class": [5, 6, 7, 5, 8], "drought_score": [4, 6, 5, 3, 7],
        "fire_score": [3, 8, 4, 2, 6], "disease_score": [5, 5, 5, 5, 5],
        "planted_count": [100, 200, 150, 90, 300],
    })
    features = build_features_v4(raw)
    features["species_target_enc"] = 0.7
    y = np.array([0.8, 0.6, 0.7, 0.85, 0.55])
    model = ExtraTreesRegressor(n_estimators=20, random_state=42, min_samples_leaf=1).fit(features, y)
    calibrator = IsotonicRegression(out_of_bounds="clip", y_min=0.0, y_max=1.0).fit(model.predict(features), y)

    bundle = {
        "model_point": model, "calibrator": calibrator, "feature_cols": list(features.columns),
        "species_map": {}, "global_mean": 0.7, "metadata": {"version": "teme-survival-v4.0-test"},
        "shap_explainer": None,
    }
    joblib.dump(bundle, legacy_model_dir / "teme_survival_v4.joblib")
    return legacy_model_dir


def test_ml_disabled_still_produces_valid_plan():
    payload = {**BASE_PAYLOAD, "ml": {"enabled": False}}
    result = run_teme(payload)
    assert result["ml_metadata"]["enabled"] is False
    assert result["ml_metadata"]["model_version"] is None
    assert result["time_to_neutral_years"] is not None


def test_ml_enabled_legacy_reports_real_resolved_version_not_hardcoded_string(legacy_model_dir):
    payload = {**BASE_PAYLOAD, "ml": {"enabled": True, "prefer_v4": False}}
    result = run_teme(payload)
    assert result["ml_metadata"]["enabled"] is True
    assert result["ml_metadata"]["model_version"] == "rf-survival-v1-2"
    assert result["ml_metadata"]["uncertainty"] is None


def test_ml_enabled_prefer_v4_but_missing_falls_back_to_legacy_without_crashing(legacy_model_dir):
    payload = {**BASE_PAYLOAD, "ml": {"enabled": True, "prefer_v4": True}}
    result = run_teme(payload)
    assert result["ml_metadata"]["enabled"] is True
    assert result["ml_metadata"]["model_version"] == "rf-survival-v1-2"


def test_ml_enabled_prefer_v4_with_v4_present_uses_v4_and_reports_its_version(legacy_and_v4_model_dir):
    payload = {**BASE_PAYLOAD, "ml": {"enabled": True, "prefer_v4": True}}
    result = run_teme(payload)
    assert result["ml_metadata"]["enabled"] is True
    assert result["ml_metadata"]["model_version"] == "teme-survival-v4.0-test"
    assert result["ml_metadata"]["uncertainty"] is not None


def test_ml_failure_never_breaks_the_engine(legacy_model_dir, monkeypatch):
    """If the ML call raises internally, the engine must still return a valid deterministic plan."""
    def broken_predict(*args, **kwargs):
        raise RuntimeError("simulated model failure")

    monkeypatch.setattr(survival_module, "predict_survival_adjustment", broken_predict)
    import ml_services.teme.core.engine as engine_module
    monkeypatch.setattr(engine_module, "predict_survival_adjustment", broken_predict)

    payload = {**BASE_PAYLOAD, "ml": {"enabled": True, "prefer_v4": False}}
    result = run_teme(payload)
    assert result["time_to_neutral_years"] is not None
    assert result["ml_metadata"]["adjustment_factors"]["Neem"] == 1.0