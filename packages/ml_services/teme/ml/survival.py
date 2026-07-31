import joblib
import numpy as np
from pathlib import Path

MODEL_DIR = Path(__file__).parent / "models"

V4_ARTIFACT_CANDIDATES = [
    MODEL_DIR / "teme_survival_v4.joblib",
]
LEGACY_MODEL_CANDIDATES = [
    MODEL_DIR / "rf_survival_v1_2.pkl",
    MODEL_DIR / "rf_survival_v1_1.pkl",
]

_state: dict = {
    "model": None,
    "model_kind": None,      # "v4_bundle" | "legacy_pickle"
    "model_version": None,   # actual resolved version string -- never hardcoded
    "resolved_path": None,
    "last_uncertainty": None,
}


def _resolve_and_load(prefer_v4: bool):
    if prefer_v4:
        for path in V4_ARTIFACT_CANDIDATES:
            if path.exists():
                try:
                    bundle = joblib.load(path)
                    version = bundle.get("metadata", {}).get("version", path.stem)
                    return bundle, "v4_bundle", version, path
                except Exception:
                    pass  # fall through to legacy -- v4 load failure must never break TEME

    for path in LEGACY_MODEL_CANDIDATES:
        if path.exists():
            model = joblib.load(path)
            version = path.stem.replace("_", "-")
            return model, "legacy_pickle", version, path

    return None, None, None, None


def load_model(prefer_v4: bool = False):
    """
    Loads (and caches) the survival model. If prefer_v4 is requested but no
    v4 artifact is found or it fails to load, falls back silently to the
    legacy pickle -- ML failure must never break the TEME engine.
    """
    need_reload = _state["model"] is None or (
        prefer_v4 and _state["model_kind"] != "v4_bundle"
    )
    if need_reload:
        model, kind, version, path = _resolve_and_load(prefer_v4)
        if model is None:
            raise FileNotFoundError("No TEME survival model artifact found (v4 or legacy).")
        _state.update(model=model, model_kind=kind, model_version=version, resolved_path=str(path))
    return _state["model"]


def get_loaded_model_version() -> str:
    """The ACTUAL resolved model version -- fixes the previous hardcoded string bug."""
    return _state["model_version"] or "none"


def get_last_uncertainty() -> dict | None:
    """Uncertainty band from the most recent v4 prediction, if any."""
    return _state["last_uncertainty"]


def predict_survival_adjustment(
    growth_rate_class: int,
    drought_score: int,
    fire_score: int,
    disease_score: int,
    planted_count: int,
    rule_based_survival: float,
    prefer_v4: bool = False,
) -> float:
    """
    Returns a bounded survival adjustment factor. Contract unchanged from
    before (still a plain float) -- call get_loaded_model_version() and
    get_last_uncertainty() afterward for the extra v4 metadata.
    """
    _state["last_uncertainty"] = None

    if rule_based_survival == 0:
        print("[TEME-ML WARNING] rule_based_survival is 0; defaulting adjustment to 1.0")
        return 1.0

    load_model(prefer_v4=prefer_v4)

    if _state["model_kind"] == "v4_bundle":
        from ml_services.teme.ml.survival_v4 import predict_v4
        result = predict_v4(
            _state["model"],
            growth_rate_class,
            drought_score,
            fire_score,
            disease_score,
            planted_count,
        )
        predicted_survival = result["point"]
        _state["last_uncertainty"] = {"p10": result["p10"], "p90": result["p90"]}
    else:
        X = np.array([[growth_rate_class, drought_score, fire_score, disease_score, planted_count]])
        predicted_survival = _state["model"].predict(X)[0]

    adjustment = predicted_survival / rule_based_survival
    adjustment = max(0.8, min(1.05, adjustment))
    return float(adjustment)