"""
TEME Monte Carlo Simulation Runner

Usage:
    python -m simulation.run_simulation

Runs Monte Carlo simulation for standard test scenarios
and prints formatted results.
"""

from typing import Dict, List

from ml_services.teme.simulation.monte_carlo import run_monte_carlo_simulation
from ml_services.teme.core.optimizer import select_species_rule_based
from ml_services.teme.data.species_catalog import SPECIES_CATALOG


# ---------------------------------------------------------------------------
# Test scenarios
# ---------------------------------------------------------------------------

SIMULATION_SCENARIOS = [
    {
        "name": "Standard 1000kg / 20yr",
        "emission_kg": 1000,
        "location": "India",
        "time_horizon": 20,
        "constraints": {
            "max_land_area_hectare": 5,
            "preferred_species": None,
            "exclude_species": None,
        },
    },
    {
        "name": "Small 200kg / 15yr",
        "emission_kg": 200,
        "location": "India",
        "time_horizon": 15,
        "constraints": {
            "max_land_area_hectare": 2,
            "preferred_species": None,
            "exclude_species": None,
        },
    },
    {
        "name": "Large 5000kg / 20yr",
        "emission_kg": 5000,
        "location": "India",
        "time_horizon": 20,
        "constraints": {
            "max_land_area_hectare": 20,
            "preferred_species": None,
            "exclude_species": None,
        },
    },
    {
        "name": "Exclude Neem 1000kg / 20yr",
        "emission_kg": 1000,
        "location": "India",
        "time_horizon": 20,
        "constraints": {
            "max_land_area_hectare": 5,
            "preferred_species": None,
            "exclude_species": ["Neem"],
        },
    },
]


def build_species_plan(
    emission_kg: float,
    location: str,
    constraints: Dict,
) -> List[Dict]:
    """
    Run the optimizer and convert its output to the format
    needed by Monte Carlo simulation.
    """
    config = select_species_rule_based(
        emission_kg=emission_kg,
        location=location,
        constraints=constraints,
    )

    plan = []
    for species, cfg in config.items():
        plan.append({
            "species": species,
            "count": cfg["count"],
            "maturity_years": cfg["maturity_years"],
            "peak_sequestration_kg": cfg["peak_sequestration_kg"],
            "annual_survival_rate": cfg["annual_survival_rate"],
        })

    return plan


def print_mc_report(name: str, result: Dict):
    """Print formatted Monte Carlo results."""
    cfg = result["simulation_config"]
    curves = result["curves"]
    payback = result["payback"]
    risk = result["risk_metrics"]
    trans = result["transparency"]

    print(f"\n{'='*65}")
    print(f"  MONTE CARLO RESULTS: {name}")
    print(f"{'='*65}")

    print(f"  Config: {cfg['n_simulations']} simulations | "
          f"Seed: {cfg['seed']} | Growth: {cfg['growth_model']}")
    print(f"  Emission: {cfg['emission_kg']} kg | "
          f"Horizon: {cfg['time_horizon']} years")

    print(f"\n  {'â”€'*61}")
    print(f"  PAYBACK ANALYSIS:")
    print(f"  {'â”€'*61}")
    print(f"    Deterministic payback:  "
          f"{payback['deterministic_years'] or 'NOT ACHIEVED'} years")
    print(f"    MC Mean payback:        "
          f"{payback['mean_years'] or 'NOT ACHIEVED'} years")
    print(f"    Risk-aware payback:     "
          f"{payback['risk_aware_years'] or 'NOT ACHIEVED'} years "
          f"(5th percentile)")

    pd = payback["payback_distribution"]
    if pd["mean"] is not None:
        print(f"\n    Payback distribution:")
        print(f"      Best case (P5):   {pd['p5']} years")
        print(f"      Median (P50):     {pd['p50']} years")
        print(f"      Worst case (P95): {pd['p95']} years")
        print(f"      Range:            {pd['min']}-{pd['max']} years")

    print(f"\n  {'â”€'*61}")
    print(f"  RISK METRICS:")
    print(f"  {'â”€'*61}")
    print(f"    Probability of offset:     "
          f"{risk['probability_of_offset']*100:.1f}%")
    print(f"    Final offset (mean):       "
          f"{risk['final_offset_mean_kg']:.0f} kg")
    print(f"    Final offset (P5):         "
          f"{risk['final_offset_p5_kg']:.0f} kg")
    print(f"    Final offset (P95):        "
          f"{risk['final_offset_p95_kg']:.0f} kg")
    print(f"    Uncertainty spread (P95-P5):"
          f" {risk['spread_p95_p5_kg']:.0f} kg")

    # Cumulative curve at key years
    print(f"\n  {'â”€'*61}")
    print(f"  CUMULATIVE OFFSET CURVE (kg CO2):")
    print(f"  {'â”€'*61}")
    print(f"  {'Year':>6s} | {'Determ.':>9s} | {'MC Mean':>9s} | "
          f"{'P5':>9s} | {'P95':>9s} | {'P5 vs Em':>9s}")
    print(f"  {'-'*6}-+-{'-'*9}-+-{'-'*9}-+-{'-'*9}-+-{'-'*9}-+-{'-'*9}")

    # Show years 0, 1, 2, 3, 5, 7, 10, 15, 20 (or up to horizon)
    key_years = [0, 1, 2, 3, 5, 7, 10, 15, 20]
    key_years = [y for y in key_years if y <= cfg["time_horizon"]]

    emission = cfg["emission_kg"]
    for y in key_years:
        det_val = curves["deterministic"][y]
        mean_val = curves["mean"][y]
        p5_val = curves["p5"][y]
        p95_val = curves["p95"][y]
        p5_pct = (p5_val / emission * 100) if emission > 0 else 0

        print(f"  {y:6d} | {det_val:9.1f} | {mean_val:9.1f} | "
              f"{p5_val:9.1f} | {p95_val:9.1f} | {p5_pct:8.1f}%")

    # Hazard info
    print(f"\n  {'â”€'*61}")
    print(f"  HAZARD PROFILE:")
    print(f"  {'â”€'*61}")
    for sp, info in result["species_hazard_info"].items():
        print(f"    {sp}: E[annual loss]={info['expected_annual_loss']*100:.2f}% | "
              f"Cal. factor={info['calibration_factor']}")

    # Transparency
    print(f"\n  {'â”€'*61}")
    print(f"  TRANSPARENCY:")
    print(f"  {'â”€'*61}")
    print(f"    Model version:     {trans['model_version']}")
    print(f"    Calibrated:        {trans['calibrated']}")
    print(f"    Growth model:      {trans['growth_model']}")
    print(f"    Hazard model:      {trans['hazard_model']}")
    print(f"    Survival sampling: {trans['survival_sampling']}")
    print(f"    Payback method:    {trans['payback_method']}")

    print(f"\n{'='*65}\n")


def run_all_simulations():
    """Run Monte Carlo for all test scenarios."""
    print("\n" + "â–ˆ" * 65)
    print("â–ˆ" + " " * 63 + "â–ˆ")
    print("â–ˆ" + "  TEME MONTE CARLO SIMULATION SUITE".center(63) + "â–ˆ")
    print("â–ˆ" + " " * 63 + "â–ˆ")
    print("â–ˆ" * 65)

    all_results = {}

    for scenario in SIMULATION_SCENARIOS:
        name = scenario["name"]
        print(f"\n{'â”€'*65}")
        print(f"  Preparing: {name}")
        print(f"{'â”€'*65}")

        try:
            plan = build_species_plan(
                emission_kg=scenario["emission_kg"],
                location=scenario["location"],
                constraints=scenario["constraints"],
            )

            result = run_monte_carlo_simulation(
                species_plan=plan,
                emission_kg=scenario["emission_kg"],
                time_horizon=scenario["time_horizon"],
                n_simulations=1000,
                seed=42,
            )

            print_mc_report(name, result)
            all_results[name] = result

        except Exception as e:
            print(f"  âŒ Error: {e}")
            all_results[name] = {"error": str(e)}

    # --- Final comparison ---
    print("\n" + "â–ˆ" * 65)
    print("â–ˆ" + " SCENARIO COMPARISON".center(63) + "â–ˆ")
    print("â–ˆ" * 65)
    print(f"\n  {'Scenario':<30s} | {'Det.':>5s} | {'Mean':>5s} | "
          f"{'P5':>5s} | {'P(off)':>7s} | {'Spread':>7s}")
    print(f"  {'-'*30}-+-{'-'*5}-+-{'-'*5}-+-{'-'*5}-+-{'-'*7}-+-{'-'*7}")

    for name, result in all_results.items():
        if "error" in result:
            print(f"  {name:<30s} | ERROR")
            continue

        pb = result["payback"]
        risk = result["risk_metrics"]
        det = pb["deterministic_years"] or "N/A"
        mean = pb["mean_years"] or "N/A"
        p5 = pb["risk_aware_years"] or "N/A"

        print(f"  {name:<30s} | {str(det):>5s} | {str(mean):>5s} | "
              f"{str(p5):>5s} | {risk['probability_of_offset']*100:6.1f}% | "
              f"{risk['spread_p95_p5_kg']:6.0f}kg")

    print(f"\n  Det. = Deterministic payback | Mean = MC mean payback")
    print(f"  P5  = Risk-aware payback (5th percentile, conservative)")
    print(f"  P(off) = Probability of achieving offset within horizon")
    print(f"  Spread = P95-P5 uncertainty at end of horizon")
    print(f"\n{'â–ˆ' * 65}\n")

    return all_results


if __name__ == "__main__":
    run_all_simulations()
