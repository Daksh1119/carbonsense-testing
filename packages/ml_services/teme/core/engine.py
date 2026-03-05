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

# --- Optional Monte Carlo import (safe) ---
try:
    from teme.simulation.monte_carlo import run_monte_carlo_simulation
    MC_AVAILABLE = True
except Exception:
    MC_AVAILABLE = False


def run_teme(input_payload: Dict[str, Any]) -> Dict[str, Any]:
    """
    Execute the TEME decision engine.

    Produces deterministic offset plan + optional Monte Carlo risk analysis.

    Input payload fields:
        emission_kg (float): CO2 emission to offset
        time_horizon_years (int): projection period
        location (str): planting region
        constraints (dict): max_land_area_hectare, preferred_species, exclude_species
        ml (dict, optional): {"enabled": true} to use ML survival adjustment
        monte_carlo (dict, optional): {
            "enabled": true,
            "n_simulations": 1000,  (default)
            "seed": 42              (default, None for non-deterministic)
        }
        species_config (dict, optional): override optimizer with manual config

    Output:
        Deterministic plan (always)
        + monte_carlo block (when enabled and successful)
        + transparency metadata

    Notes:
        - Year index t = 0 corresponds to planting year
        - time_to_neutral_years = deterministic payback (linear growth)
        - monte_carlo.risk_aware_payback_years = conservative payback (logistic + hazards)
        - MC failure NEVER breaks the engine — falls back to deterministic only
    """

    E = input_payload["emission_kg"]
    T = input_payload["time_horizon_years"]
    constraints = input_payload["constraints"]

    ml_enabled = input_payload.get("ml", {}).get("enabled", False)
    mc_config = input_payload.get("monte_carlo", {})
    mc_enabled = mc_config.get("enabled", False)

    # --- Select species (rule-based optimizer) or use provided config ---
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

    # --- Annual sequestration computation (deterministic, linear growth) ---
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
                "annual_sequestration_kg": [round(v, 4) for v in alpha],
                "survival_curve": [round(v, 4) for v in adjusted_sigma],
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

    # --- Confidence score (heuristic baseline, may be upgraded by MC) ---
    if T > 0:
        confidence = max(0.3, 1.0 - (offset_year / T))
    else:
        confidence = 0.3

    # ===================================================================
    # MONTE CARLO SIMULATION (optional, never breaks deterministic output)
    # ===================================================================
    mc_result = None

    if mc_enabled and MC_AVAILABLE:
        try:
            # Build species plan from optimizer output
            mc_species_plan = []
            for species, cfg in species_config.items():
                mc_species_plan.append({
                    "species": species,
                    "count": cfg["count"],
                    "maturity_years": cfg["maturity_years"],
                    "peak_sequestration_kg": cfg["peak_sequestration_kg"],
                    "annual_survival_rate": cfg["annual_survival_rate"],
                })

            mc_n_sims = mc_config.get("n_simulations", 1000)
            mc_seed = mc_config.get("seed", 42)

            mc_raw = run_monte_carlo_simulation(
                species_plan=mc_species_plan,
                emission_kg=E,
                time_horizon=T,
                n_simulations=mc_n_sims,
                seed=mc_seed,
            )

            # --- Upgrade confidence using MC probability ---
            mc_probability = mc_raw["risk_metrics"]["probability_of_offset"]
            confidence = round(mc_probability, 4)

            # --- Extract key MC outputs ---
            mc_result = {
                "risk_aware_payback_years": mc_raw["payback"]["risk_aware_years"],
                "mean_payback_years": mc_raw["payback"]["mean_years"],
                "probability_of_offset": mc_probability,
                "payback_distribution": mc_raw["payback"]["payback_distribution"],
                "risk_metrics": mc_raw["risk_metrics"],
                "curves": mc_raw["curves"],
                "species_hazard_info": mc_raw["species_hazard_info"],
                "transparency": mc_raw["transparency"],
            }

            # --- Add MC-specific warnings ---
            risk_aware = mc_raw["payback"]["risk_aware_years"]
            if risk_aware is not None and risk_aware > offset_year:
                warnings.append(
                    f"Risk-aware payback ({risk_aware}yr) is "
                    f"{risk_aware - offset_year}yr later than deterministic "
                    f"({offset_year}yr)"
                )

            spread = mc_raw["risk_metrics"]["spread_p95_p5_kg"]
            if spread > E * 0.5:
                warnings.append(
                    f"High uncertainty: P95-P5 spread ({spread:.0f} kg) "
                    f"exceeds 50% of emission target ({E} kg)"
                )

        except Exception as e:
            # MC failure must NEVER break TEME
            mc_result = {
                "error": str(e),
                "fallback": "deterministic_only",
            }
            warnings.append(
                f"Monte Carlo simulation failed: {e}. "
                f"Using deterministic estimates only."
            )

    elif mc_enabled and not MC_AVAILABLE:
        mc_result = {
            "error": "Monte Carlo module not available",
            "fallback": "deterministic_only",
        }
        warnings.append(
            "Monte Carlo requested but simulation module not available. "
            "Using deterministic estimates only."
        )

    # --- Final output (backward-compatible + MC-extended) ---
    result = {
        "offset_plan": offset_plan,
        "total_trees": sum(species_counts.values()),
        "land_required_hectare": round(land_required, 4),
        "time_to_neutral_years": offset_year,
        "confidence_score": round(confidence, 2),
        "warnings": list(dict.fromkeys(warnings)),
        "ml_metadata": {
            "enabled": bool(ml_enabled and ML_AVAILABLE),
            "model_version": (
                "rf-survival-v1.1" if ml_enabled and ML_AVAILABLE else None
            ),
            "adjustment_factors": (
                ml_adjustments if ml_enabled and ML_AVAILABLE else {}
            ),
        },
    }

    # Only include monte_carlo key when MC was requested
    if mc_enabled:
        result["monte_carlo"] = mc_result

    return result