from typing import Dict, Any, List

from teme.core.sequestration import generate_sequestration_curve
from teme.core.survival import generate_survival_curve
from teme.core.land import calculate_land_required
from teme.core.exceptions import InfeasiblePlanError
from teme.core.optimizer import select_species_rule_based

# --- Optional ML import (safe) ---
try:
    from teme.ml.survival import predict_survival_adjustment
    ML_AVAILABLE = True
except Exception:
    ML_AVAILABLE = False


def run_teme(input_payload: Dict[str, Any]) -> Dict[str, Any]:
    """
    Execute the TEME decision engine.

    Notes:
    - Year index t = 0 corresponds to planting year
    - time_to_neutral_years is measured in year offsets from start_year
    """

    E = input_payload["emission_kg"]
    T = input_payload["time_horizon_years"]
    constraints = input_payload["constraints"]

    ml_enabled = input_payload.get("ml", {}).get("enabled", False)

    # --- Select species (rule-based optimizer) or use provided config ---
    # NOTE:
    # species_config is accepted only for testing/internal use.
    # External callers must NOT provide species_config.
    if "species_config" in input_payload:
        species_config = input_payload["species_config"]
    else:
        species_config = select_species_rule_based(
            emission_kg=E,
            location=input_payload["location"],
            constraints=constraints,
        )

    cumulative = [0.0] * (T + 1)
    annual_total = [0.0] * (T + 1)

    offset_year = None
    warnings: List[str] = []

    # --- Land constraint check ---
    species_counts = {s: cfg["count"] for s, cfg in species_config.items()}
    land_per_tree = {s: cfg["land_per_tree"] for s, cfg in species_config.items()}

    land_required = calculate_land_required(species_counts, land_per_tree)

    if land_required > constraints["max_land_area_hectare"]:
        raise InfeasiblePlanError("Land constraint violated")

    if land_required > 0.9 * constraints["max_land_area_hectare"]:
        warnings.append("Land constraint nearly saturated")

    # --- Annual sequestration computation ---
    offset_plan = []
    ml_adjustments = {}

    for species, cfg in species_config.items():
        alpha = generate_sequestration_curve(
            cfg["maturity_years"],
            cfg["peak_sequestration_kg"],
            T,
        )

        sigma = generate_survival_curve(
            cfg["annual_survival_rate"],
            T,
        )

        if min(sigma) < 0.85:
            warnings.append(
                f"Survival drops below 85% for species {species}"
            )

        # --- Optional ML-based survival adjustment ---
        adjusted_sigma = list(sigma)
        adjustment_factor = 1.0

        if ml_enabled and ML_AVAILABLE:
            try:
                adjustment_factor = predict_survival_adjustment(
                    growth_rate_class=cfg["growth_rate_class"],
                    drought_score=cfg["drought_score"],
                    fire_score=cfg["fire_score"],
                    disease_score=cfg["disease_score"],
                    planted_count=cfg["count"],
                    rule_based_survival=sigma[0],
                )

                adjusted_sigma = [
                    min(1.0, s * adjustment_factor) for s in sigma
                ]

            except Exception:
                # ML failure must NEVER break TEME
                adjustment_factor = 1.0

        ml_adjustments[species] = round(adjustment_factor, 3)

        for t in range(T + 1):
            annual_total[t] += cfg["count"] * alpha[t] * adjusted_sigma[t]

        offset_plan.append(
            {
                "species": species,
                "count": cfg["count"],
                "annual_sequestration_kg": alpha,
                "survival_curve": adjusted_sigma,
            }
        )

    # --- Cumulative sequestration & offset detection ---
    for t in range(T + 1):
        cumulative[t] = annual_total[t] + (cumulative[t - 1] if t > 0 else 0.0)

        if offset_year is None and cumulative[t] >= E:
            offset_year = t

    if offset_year is None:
        raise InfeasiblePlanError(
            "Carbon neutrality not achievable within time horizon"
        )

    if offset_year > 10:
        warnings.append("Offset not achieved in first 10 years")

    # --- Confidence score (heuristic, bounded) ---
    if T > 0:
        confidence = max(0.3, 1.0 - (offset_year / T))
    else:
        confidence = 0.3

    # --- Final output (contract-compliant + ML transparent) ---
    return {
        "offset_plan": offset_plan,
        "total_trees": sum(species_counts.values()),
        "land_required_hectare": land_required,
        "time_to_neutral_years": offset_year,
        "confidence_score": round(confidence, 2),
        "warnings": list(dict.fromkeys(warnings)),  # deterministic dedupe
        "ml_metadata": {
            "enabled": bool(ml_enabled and ML_AVAILABLE),
            "model_version": "rf-survival-v1.1" if ml_enabled and ML_AVAILABLE else None,
            "adjustment_factors": ml_adjustments if ml_enabled and ML_AVAILABLE else {},
        },
    }
