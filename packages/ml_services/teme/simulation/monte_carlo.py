"""
TEME Monte Carlo Time-Debt Simulation

Replaces the deterministic time-debt curve with a stochastic simulation
that accounts for:
  1. Survival probability uncertainty (Beta distribution sampling)
  2. Catastrophic mortality events (drought, fire, disease, pest)
  3. Logistic growth curve (not linear ramp to maturity)

For each planting plan, runs N simulations (default 1000).
Each simulation independently:
  - Samples a survival rate from calibrated Beta distribution
  - At each year, rolls for hazard events
  - Applies sequestration based on surviving population
  - Accumulates total offset

Outputs:
  - Mean cumulative offset curve
  - 5th percentile curve (conservative — used for risk-aware payback)
  - 95th percentile curve (optimistic)
  - Deterministic baseline for comparison
  - Risk-aware payback year (when P5 curve >= emission)
  - Probability of achieving offset within time horizon

Scientific basis:
  Monte Carlo simulation for forestry risk assessment:
    Vanclay, J.K. (1994). Modelling Forest Growth and Yield.
    Kangas, A. (1997). "On the prediction bias in forest inventory."
"""

import random
import math
from typing import Dict, List, Any, Optional

from teme.simulation.hazard_model import (
    simulate_hazard_events_for_year,
    compute_expected_annual_hazard_loss,
)
from teme.calibration.confidence import (
    get_calibration_factors,
    compute_survival_confidence,
)
from teme.core.sequestration import generate_sequestration_curve
from teme.core.survival import generate_survival_curve
from teme.data.species_catalog import SPECIES_CATALOG


# ---------------------------------------------------------------------------
# Logistic growth curve (replaces linear ramp for MC)
# ---------------------------------------------------------------------------

def logistic_sequestration(
    t: int,
    peak_kg: float,
    maturity_years: int,
) -> float:
    """
    Logistic (S-curve) growth model for per-tree annual sequestration.

    More realistic than linear ramp:
      - Slow initial growth (sapling establishment)
      - Accelerating growth (canopy development)
      - Plateau at maturity

    Formula: A(t) = peak / (1 + exp(-k * (t - t0)))
    where:
      k = steepness (derived from maturity_years)
      t0 = inflection point (maturity / 2)
    """
    if t <= 0:
        return 0.0

    t0 = maturity_years / 2.0
    k = 6.0 / maturity_years  # Steepness: 95% of peak by maturity

    value = peak_kg / (1.0 + math.exp(-k * (t - t0)))

    # Subtract baseline so A(0) ≈ 0
    baseline = peak_kg / (1.0 + math.exp(-k * (0 - t0)))
    adjusted = value - baseline

    return max(0.0, adjusted)


# ---------------------------------------------------------------------------
# Single simulation run
# ---------------------------------------------------------------------------

def run_single_simulation(
    species_plan: List[Dict],
    time_horizon: int,
    rng: random.Random,
    cal_factors: Dict,
    global_factor: float,
) -> Dict:
    """
    Execute one Monte Carlo simulation run.

    For each species in the plan:
      1. Sample survival rate from Beta distribution
      2. At each year: apply background survival + hazard events
      3. Compute sequestration from surviving trees

    Returns per-year cumulative offset for this run.
    """
    annual_total = [0.0] * (time_horizon + 1)
    species_events = {}

    for sp_plan in species_plan:
        species = sp_plan["species"]
        count = sp_plan["count"]
        maturity = sp_plan["maturity_years"]
        peak_kg = sp_plan["peak_sequestration_kg"]
        base_rate = sp_plan["annual_survival_rate"]

        # --- Sample survival rate from calibrated Beta distribution ---
        cal_factor = cal_factors.get(species, global_factor)

        # Get sample size for Beta distribution
        catalog = SPECIES_CATALOG.get(species, {})
        sample_size = 400  # default

        # Use calibration confidence to get Beta params
        conf = compute_survival_confidence(
            predicted_survival=base_rate,
            sample_size=sample_size,
            calibration_factor=cal_factor,
        )

        # Sample from Beta distribution
        alpha_param = conf["beta_alpha"]
        beta_param = conf["beta_beta"]
        sampled_annual_rate = rng.betavariate(alpha_param, beta_param)
        sampled_annual_rate = max(0.5, min(0.99, sampled_annual_rate))

        # --- Simulate year by year ---
        surviving_fraction = 1.0
        year_events = []

        for t in range(time_horizon + 1):
            if t > 0:
                # Background mortality
                surviving_fraction *= sampled_annual_rate

                # Catastrophic events
                surviving_fraction, events = simulate_hazard_events_for_year(
                    species_name=species,
                    surviving_fraction=surviving_fraction,
                    rng=rng,
                )
                if events:
                    year_events.append({"year": t, "events": events})

            # Sequestration from surviving trees (logistic growth)
            per_tree_kg = logistic_sequestration(t, peak_kg, maturity)
            effective_trees = count * surviving_fraction
            annual_total[t] += effective_trees * per_tree_kg

        species_events[species] = {
            "sampled_rate": round(sampled_annual_rate, 4),
            "final_survival": round(surviving_fraction, 4),
            "hazard_events": len(year_events),
        }

    # Build cumulative
    cumulative = [0.0] * (time_horizon + 1)
    for t in range(time_horizon + 1):
        cumulative[t] = annual_total[t] + (cumulative[t - 1] if t > 0 else 0.0)

    return {
        "annual": annual_total,
        "cumulative": cumulative,
        "species_details": species_events,
    }


# ---------------------------------------------------------------------------
# Full Monte Carlo simulation
# ---------------------------------------------------------------------------

def run_monte_carlo_simulation(
    species_plan: List[Dict],
    emission_kg: float,
    time_horizon: int,
    n_simulations: int = 1000,
    seed: Optional[int] = 42,
) -> Dict:
    """
    Run N Monte Carlo simulations and aggregate results.

    Args:
        species_plan: list of species dicts from optimizer/engine
            Each needs: species, count, maturity_years,
            peak_sequestration_kg, annual_survival_rate
        emission_kg: target emission to offset
        time_horizon: projection years
        n_simulations: number of MC runs (default 1000)
        seed: random seed for reproducibility (None = non-deterministic)

    Returns:
        Comprehensive MC results with percentile curves,
        risk-aware payback, and transparency metadata.
    """
    print(f"[TEME MONTE CARLO] Starting {n_simulations} simulations...")
    print(f"[TEME MONTE CARLO] Emission target: {emission_kg} kg CO2")
    print(f"[TEME MONTE CARLO] Time horizon: {time_horizon} years")
    print(f"[TEME MONTE CARLO] Species in plan: "
          f"{[s['species'] for s in species_plan]}")

    rng = random.Random(seed)

    # Load calibration factors
    try:
        cal_data = get_calibration_factors()
        cal_factors = cal_data["species_factors"]
        global_factor = cal_data["global_factor"]
        calibration_available = True
    except Exception:
        cal_factors = {}
        global_factor = 1.0
        calibration_available = False
        print("[TEME MONTE CARLO WARNING] Calibration unavailable, "
              "using raw survival rates")

    # --- Run all simulations ---
    all_cumulative = []  # List of cumulative curves (one per simulation)
    all_final_offsets = []
    payback_years = []

    for i in range(n_simulations):
        sim_rng = random.Random(rng.randint(0, 2**31))
        result = run_single_simulation(
            species_plan=species_plan,
            time_horizon=time_horizon,
            rng=sim_rng,
            cal_factors=cal_factors,
            global_factor=global_factor,
        )

        all_cumulative.append(result["cumulative"])
        all_final_offsets.append(result["cumulative"][time_horizon])

        # Find payback year for this run
        payback = None
        for t in range(time_horizon + 1):
            if result["cumulative"][t] >= emission_kg:
                payback = t
                break
        payback_years.append(payback)

    # --- Compute percentile curves ---
    mean_curve = [0.0] * (time_horizon + 1)
    p5_curve = [0.0] * (time_horizon + 1)
    p25_curve = [0.0] * (time_horizon + 1)
    p50_curve = [0.0] * (time_horizon + 1)
    p75_curve = [0.0] * (time_horizon + 1)
    p95_curve = [0.0] * (time_horizon + 1)

    for t in range(time_horizon + 1):
        values_at_t = sorted([c[t] for c in all_cumulative])
        n = len(values_at_t)

        mean_curve[t] = sum(values_at_t) / n
        p5_curve[t] = values_at_t[int(n * 0.05)]
        p25_curve[t] = values_at_t[int(n * 0.25)]
        p50_curve[t] = values_at_t[int(n * 0.50)]
        p75_curve[t] = values_at_t[int(n * 0.75)]
        p95_curve[t] = values_at_t[min(int(n * 0.95), n - 1)]

    # --- Deterministic baseline (for comparison) ---
    det_annual = [0.0] * (time_horizon + 1)
    for sp_plan in species_plan:
        alpha = generate_sequestration_curve(
            sp_plan["maturity_years"],
            sp_plan["peak_sequestration_kg"],
            time_horizon,
        )
        sigma = generate_survival_curve(
            sp_plan["annual_survival_rate"],
            time_horizon,
        )
        for t in range(time_horizon + 1):
            det_annual[t] += sp_plan["count"] * alpha[t] * sigma[t]

    det_cumulative = [0.0] * (time_horizon + 1)
    for t in range(time_horizon + 1):
        det_cumulative[t] = det_annual[t] + (
            det_cumulative[t - 1] if t > 0 else 0.0
        )

    # --- Risk-aware payback (5th percentile) ---
    risk_aware_payback = None
    for t in range(time_horizon + 1):
        if p5_curve[t] >= emission_kg:
            risk_aware_payback = t
            break

    # --- Mean payback ---
    mean_payback = None
    for t in range(time_horizon + 1):
        if mean_curve[t] >= emission_kg:
            mean_payback = t
            break

    # --- Deterministic payback ---
    det_payback = None
    for t in range(time_horizon + 1):
        if det_cumulative[t] >= emission_kg:
            det_payback = t
            break

    # --- Probability of achieving offset ---
    achieved_count = sum(
        1 for p in payback_years if p is not None
    )
    probability_of_offset = achieved_count / n_simulations

    # --- Payback year distribution ---
    valid_paybacks = [p for p in payback_years if p is not None]
    if valid_paybacks:
        payback_mean = sum(valid_paybacks) / len(valid_paybacks)
        payback_min = min(valid_paybacks)
        payback_max = max(valid_paybacks)
        sorted_pb = sorted(valid_paybacks)
        payback_p5 = sorted_pb[int(len(sorted_pb) * 0.05)]
        payback_p50 = sorted_pb[int(len(sorted_pb) * 0.50)]
        payback_p95 = sorted_pb[min(int(len(sorted_pb) * 0.95), len(sorted_pb) - 1)]
    else:
        payback_mean = None
        payback_min = None
        payback_max = None
        payback_p5 = None
        payback_p50 = None
        payback_p95 = None

    # --- Expected hazard losses (for transparency) ---
    hazard_info = {}
    for sp_plan in species_plan:
        sp = sp_plan["species"]
        hazard_info[sp] = {
            "expected_annual_loss": compute_expected_annual_hazard_loss(sp),
            "calibration_factor": cal_factors.get(sp, global_factor),
        }

    # --- Build output ---
    output = {
        "simulation_config": {
            "n_simulations": n_simulations,
            "seed": seed,
            "emission_kg": emission_kg,
            "time_horizon": time_horizon,
            "calibration_used": calibration_available,
            "growth_model": "logistic",
        },
        "curves": {
            "years": list(range(time_horizon + 1)),
            "mean": [round(v, 2) for v in mean_curve],
            "p5": [round(v, 2) for v in p5_curve],
            "p25": [round(v, 2) for v in p25_curve],
            "p50": [round(v, 2) for v in p50_curve],
            "p75": [round(v, 2) for v in p75_curve],
            "p95": [round(v, 2) for v in p95_curve],
            "deterministic": [round(v, 2) for v in det_cumulative],
        },
        "payback": {
            "deterministic_years": det_payback,
            "mean_years": mean_payback,
            "risk_aware_years": risk_aware_payback,
            "payback_distribution": {
                "mean": round(payback_mean, 1) if payback_mean else None,
                "min": payback_min,
                "max": payback_max,
                "p5": payback_p5,
                "p50": payback_p50,
                "p95": payback_p95,
            },
        },
        "risk_metrics": {
            "probability_of_offset": round(probability_of_offset, 4),
            "final_offset_mean_kg": round(mean_curve[time_horizon], 2),
            "final_offset_p5_kg": round(p5_curve[time_horizon], 2),
            "final_offset_p95_kg": round(p95_curve[time_horizon], 2),
            "spread_p95_p5_kg": round(
                p95_curve[time_horizon] - p5_curve[time_horizon], 2
            ),
        },
        "species_hazard_info": hazard_info,
        "transparency": {
            "model_version": "teme_mc_v1.0",
            "calibrated": calibration_available,
            "growth_model": "logistic",
            "hazard_model": "per_species_annual_events",
            "survival_sampling": "beta_distribution",
            "payback_method": "5th_percentile_conservative",
        },
    }

    return output