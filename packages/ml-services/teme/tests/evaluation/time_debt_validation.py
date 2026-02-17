"""
TEME Time-Debt Projection Validation

Compares:
  - Deterministic (linear growth, raw survival) vs MC mean (logistic, calibrated)
  - Raw MAPE captures total model divergence (expected to be significant)
  - Stochastic MAPE isolates Monte Carlo randomness only

Metrics:
  - Model Divergence MAPE: det vs MC mean (allowed up to 50% — different models)
  - Year-by-year comparison at key checkpoints
  - Payback year consistency

The MC uses logistic growth + calibrated survival + hazard events,
so divergence from linear deterministic is EXPECTED and DESIRED.
The test validates that divergence is bounded and explainable.
"""

from typing import Dict, List
from teme.core.engine import run_teme


VALIDATION_SCENARIOS = [
    {
        "name": "Neem 1000kg/20yr",
        "emission_kg": 1000,
        "location": "India",
        "time_horizon_years": 20,
        "constraints": {"max_land_area_hectare": 5},
    },
    {
        "name": "Peepal 1000kg/20yr",
        "emission_kg": 1000,
        "location": "India",
        "time_horizon_years": 20,
        "constraints": {
            "max_land_area_hectare": 5,
            "exclude_species": ["Neem"],
        },
    },
    {
        "name": "Small 200kg/15yr",
        "emission_kg": 200,
        "location": "India",
        "time_horizon_years": 15,
        "constraints": {"max_land_area_hectare": 2},
    },
    {
        "name": "Large 5000kg/20yr",
        "emission_kg": 5000,
        "location": "India",
        "time_horizon_years": 20,
        "constraints": {"max_land_area_hectare": 20},
    },
]


def compute_mape(curve_a: List[float], curve_b: List[float]) -> float:
    """
    Mean Absolute Percentage Error between two curves.
    Skips year 0 (both are 0.0) and years where reference is near zero.
    """
    errors = []
    for t in range(1, min(len(curve_a), len(curve_b))):
        ref_val = curve_a[t]
        cmp_val = curve_b[t]
        if abs(ref_val) > 1.0:  # Skip near-zero reference values
            errors.append(abs(ref_val - cmp_val) / abs(ref_val))
    return sum(errors) / len(errors) if errors else 0.0


def compute_mc_consistency(mc_curves: Dict) -> float:
    """
    Compare MC mean vs MC P50 (median) to check for simulation consistency.
    Low divergence = stable simulation. This isolates stochastic noise.
    """
    mean_curve = mc_curves["mean"]
    p50_curve = mc_curves["p50"]
    return compute_mape(mean_curve, p50_curve)


def validate_single_scenario(scenario: Dict) -> Dict:
    """Run engine with MC and compute all validation metrics."""
    payload = {
        "emission_kg": scenario["emission_kg"],
        "location": scenario["location"],
        "time_horizon_years": scenario["time_horizon_years"],
        "constraints": scenario["constraints"],
        "monte_carlo": {"enabled": True, "n_simulations": 500, "seed": 42},
    }

    result = run_teme(payload)
    mc = result["monte_carlo"]

    det_curve = mc["curves"]["deterministic"]
    mean_curve = mc["curves"]["mean"]
    p5_curve = mc["curves"]["p5"]
    p50_curve = mc["curves"]["p50"]
    p95_curve = mc["curves"]["p95"]

    T = scenario["time_horizon_years"]
    emission = scenario["emission_kg"]

    # --- Metric 1: Model Divergence MAPE (det vs MC mean) ---
    # This is expected to be high because det=linear growth, MC=logistic+calibrated
    model_divergence_mape = compute_mape(det_curve, mean_curve)

    # --- Metric 2: MC consistency (mean vs P50) ---
    # This should be LOW — isolates pure stochastic noise
    mc_consistency = compute_mc_consistency(mc["curves"])

    # --- Metric 3: Spread ratio at end of horizon ---
    spread_end = p95_curve[T] - p5_curve[T]
    spread_ratio = spread_end / mean_curve[T] if mean_curve[T] > 0 else 0.0

    # --- Payback comparison ---
    det_payback = result["time_to_neutral_years"]
    mc_mean_payback = mc["mean_payback_years"]
    mc_risk_payback = mc["risk_aware_payback_years"]

    payback_gap = (
        (mc_risk_payback - det_payback)
        if mc_risk_payback is not None and det_payback is not None
        else None
    )

    # --- Monotonicity check (curves must be non-decreasing) ---
    mean_monotonic = all(
        mean_curve[t] >= mean_curve[t - 1] - 0.01
        for t in range(1, T + 1)
    )
    det_monotonic = all(
        det_curve[t] >= det_curve[t - 1] - 0.01
        for t in range(1, T + 1)
    )

    # --- Direction check: MC mean should converge toward det at horizon ---
    # (calibration boosts survival, logistic catches up eventually)
    final_ratio = mean_curve[T] / det_curve[T] if det_curve[T] > 0 else 1.0

    # --- Key year comparison ---
    key_years = [1, 3, 5, 10, min(15, T), T]
    key_years = sorted(set(y for y in key_years if y <= T))

    yearly_comparison = []
    for y in key_years:
        yearly_comparison.append({
            "year": y,
            "deterministic": round(det_curve[y], 1),
            "mc_mean": round(mean_curve[y], 1),
            "mc_p5": round(p5_curve[y], 1),
            "mc_p95": round(p95_curve[y], 1),
            "pct_of_emission_p5": round(p5_curve[y] / emission * 100, 1),
        })

    # --- Pass criteria ---
    # MC consistency (mean vs P50) should be < 15% (low stochastic noise)
    # Model divergence is allowed up to 50% (different growth models)
    # Curves must be monotonic
    # Final MC/det ratio should be between 0.3 and 3.0 (bounded divergence)
    mc_consistency_ok = mc_consistency <= 0.15
    divergence_bounded = model_divergence_mape <= 0.50
    monotonic = mean_monotonic and det_monotonic
    ratio_bounded = 0.3 <= final_ratio <= 3.0

    passed = mc_consistency_ok and divergence_bounded and monotonic and ratio_bounded

    return {
        "name": scenario["name"],
        "model_divergence_mape": round(model_divergence_mape, 4),
        "model_divergence_mape_pct": round(model_divergence_mape * 100, 2),
        "mc_consistency_mape": round(mc_consistency, 4),
        "mc_consistency_pct": round(mc_consistency * 100, 2),
        "mc_consistency_ok": mc_consistency_ok,
        "divergence_bounded": divergence_bounded,
        "monotonic": monotonic,
        "final_mc_det_ratio": round(final_ratio, 4),
        "ratio_bounded": ratio_bounded,
        "spread_ratio_end": round(spread_ratio, 4),
        "payback_deterministic": det_payback,
        "payback_mc_mean": mc_mean_payback,
        "payback_risk_aware": mc_risk_payback,
        "payback_gap": payback_gap,
        "probability_of_offset": mc["probability_of_offset"],
        "yearly_comparison": yearly_comparison,
        "passed": passed,
    }


def run_time_debt_validation() -> Dict:
    """Run all time-debt validation scenarios."""
    results = []

    for scenario in VALIDATION_SCENARIOS:
        result = validate_single_scenario(scenario)
        results.append(result)

    all_passed = all(r["passed"] for r in results)

    # Aggregate metrics
    avg_divergence = sum(r["model_divergence_mape"] for r in results) / len(results)
    avg_consistency = sum(r["mc_consistency_mape"] for r in results) / len(results)

    return {
        "metric": "time_debt_validation",
        "avg_model_divergence_pct": round(avg_divergence * 100, 2),
        "avg_mc_consistency_pct": round(avg_consistency * 100, 2),
        "all_scenarios_passed": all_passed,
        "target": (
            "MC consistency (mean vs P50) < 15%, "
            "Model divergence < 50%, "
            "Monotonic curves, "
            "Final ratio 0.3-3.0"
        ),
        "passed": all_passed,
        "scenarios": results,
    }