import joblib
import numpy as np
from pathlib import Path

MODEL_PATH = Path(__file__).parent / "models" / "rf_survival_v1_1.pkl"

_model = None

def load_model():
    global _model
    if _model is None:
        _model = joblib.load(MODEL_PATH)
    return _model


def predict_survival_adjustment(
    growth_rate_class: int,
    drought_score: int,
    fire_score: int,
    disease_score: int,
    planted_count: int,
    rule_based_survival: float
) -> float:
    """
    Returns a bounded survival adjustment factor.
    """
    if rule_based_survival == 0:
        print("[TEME-ML WARNING] rule_based_survival is 0; defaulting adjustment to 1.0")
        return 1.0

    model = load_model()

    X = np.array([[
        growth_rate_class,
        drought_score,
        fire_score,
        disease_score,
        planted_count
    ]])

    predicted_survival = model.predict(X)[0]

    # Convert to adjustment factor
    adjustment = predicted_survival / rule_based_survival

    # Safety bounds
    adjustment = max(0.8, min(1.05, adjustment))

    return float(adjustment)