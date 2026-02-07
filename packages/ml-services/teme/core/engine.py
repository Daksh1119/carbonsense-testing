from typing import Dict, Any, List

from teme.core.sequestration import generate_sequestration_curve
from teme.core.survival import generate_survival_curve
from teme.core.land import calculate_land_required
from teme.core.exceptions import InfeasiblePlanError


def run_teme(input_payload: Dict[str, Any]) -> Dict[str, Any]:
    E = input_payload["emission_kg"]
    T = input_payload["time_horizon_years"]
    constraints = input_payload["constraints"]

    species_config = input_payload["species_config"]
    # species_config example:
    # {
    #   "Neem": {
    #       "count": 120,
    #       "maturity_years": 6,
    #       "peak_sequestration_kg": 25,
    #       "annual_survival_rate": 0.95,
    #       "land_per_tree": 0.01
    #   }
    # }

    cumulative = [0.0] * (T + 1)
    annual_total = [0.0] * (T + 1)

    offset_year = None
    warnings: List[str] = []

    # --- Land check ---
    species_counts = {
        s: cfg["count"] for s, cfg in species_config.items()
    }
    land_per_tree = {
        s: cfg["land_per_tree"] for s, cfg in species_config.items()
    }

    land_required = calculate_land_required(
        species_counts, land_per_tree
    )

    if land_required > constraints["max_land_area_hectare"]:
        raise InfeasiblePlanError("Land constraint violated")

    if land_required > 0.9 * constraints["max_land_area_hectare"]:
        warnings.append("Land constraint nearly saturated")

    # --- Annual sequestration ---
    for species, cfg in species_config.items():
        alpha = generate_sequestration_curve(
            cfg["maturity_years"],
            cfg["peak_sequestration_kg"],
            T
        )
        sigma = generate_survival_curve(
            cfg["annual_survival_rate"],
            T
        )

        if min(sigma) < 0.85:
            warnings.append(
                f"Survival drops below 85% for species {species}"
            )

        for t in range(T + 1):
            annual_total[t] += (
                cfg["count"] * alpha[t] * sigma[t]
            )

    # --- Cumulative sum ---
    for t in range(T + 1):
        cumulative[t] = annual_total[t] + (cumulative[t - 1] if t > 0 else 0)

        if offset_year is None and cumulative[t] >= E:
            offset_year = t

    if offset_year is None:
        raise InfeasiblePlanError(
            "Carbon neutrality not achievable within time horizon"
        )

    if offset_year > 10:
        warnings.append("Offset not achieved in first 10 years")

    confidence = max(0.3, 1 - (offset_year / T))

    return {
        "total_trees": sum(species_counts.values()),
        "land_required_hectare": land_required,
        "time_to_neutral_years": offset_year,
        "confidence_score": round(confidence, 2),
        "warnings": list(set(warnings)),
    }
