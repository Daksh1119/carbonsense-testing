"""
TEME Cost Realism Validation

Compares TEME's cost-per-kg-CO2 against literature benchmarks
to ensure we're not producing unrealistic numbers.

Benchmarks:
  - IPCC range: $5-50 per tonne CO2 for afforestation
  - Indian plantation costs: ₹300-650 per tree (ICFRE)
  - Carbon market spot price: ~$15-25 per tonne

Flag if:
  - Cost/kg < unrealistic lower bound (too cheap = greenwashing)
  - Cost/kg > impractical upper bound (too expensive = bad advice)
"""

from typing import Dict
from teme.core.engine import run_teme
from teme.data.species_catalog import SPECIES_CATALOG


# Literature benchmarks (INR per kg CO2 offset)
# IPCC: $5-50/tonne = ₹400-4000/tonne = ₹0.4-4.0/kg
COST_BENCHMARKS = {
    "ipcc_lower_inr_per_kg": 0.4,    # Very optimistic
    "ipcc_upper_inr_per_kg": 4.0,    # Conservative
    "acceptable_lower": 0.1,          # Floor — below this is suspiciously cheap
    "acceptable_upper": 15.0,         # Ceiling — above this is impractical
}


def compute_cost_per_kg(
    emission_kg: float,
    location: str,
    time_horizon: int,
) -> Dict:
    """
    Run TEME and compute cost per kg CO2 offset.
    Uses species_catalog cost_per_tree_total_inr.
    """
    payload = {
        "emission_kg": emission_kg,
        "location": location,
        "time_horizon_years": time_horizon,
        "constraints": {"max_land_area_hectare": 50},
        "monte_carlo": {"enabled": True, "n_simulations": 200, "seed": 42},
    }

    result = run_teme(payload)
    mc = result.get("monte_carlo", {})

    # Compute total cost from species counts
    total_cost_inr = 0
    for entry in result["offset_plan"]:
        species = entry["species"]
        count = entry["count"]
        cost = SPECIES_CATALOG.get(species, {}).get(
            "cost_per_tree_total_inr", 500
        )
        total_cost_inr += count * cost

    # Deterministic offset at horizon
    det_curve = mc.get("curves", {}).get("deterministic", [])
    det_offset = det_curve[time_horizon] if det_curve else emission_kg

    # MC mean offset at horizon
    mean_curve = mc.get("curves", {}).get("mean", [])
    mc_offset = mean_curve[time_horizon] if mean_curve else det_offset

    # P5 offset (conservative)
    p5_curve = mc.get("curves", {}).get("p5", [])
    p5_offset = p5_curve[time_horizon] if p5_curve else det_offset

    cost_per_kg_det = total_cost_inr / det_offset if det_offset > 0 else 0
    cost_per_kg_mc = total_cost_inr / mc_offset if mc_offset > 0 else 0
    cost_per_kg_p5 = total_cost_inr / p5_offset if p5_offset > 0 else 0

    # Check against benchmarks
    in_ipcc_range = (
        COST_BENCHMARKS["ipcc_lower_inr_per_kg"]
        <= cost_per_kg_mc
        <= COST_BENCHMARKS["ipcc_upper_inr_per_kg"]
    )
    in_acceptable_range = (
        COST_BENCHMARKS["acceptable_lower"]
        <= cost_per_kg_mc
        <= COST_BENCHMARKS["acceptable_upper"]
    )

    flags = []
    if cost_per_kg_mc < COST_BENCHMARKS["acceptable_lower"]:
        flags.append("SUSPICIOUSLY CHEAP — possible greenwashing risk")
    if cost_per_kg_mc > COST_BENCHMARKS["acceptable_upper"]:
        flags.append("IMPRACTICALLY EXPENSIVE — bad advice risk")
    if not in_ipcc_range:
        flags.append(
            f"Outside IPCC range (₹{COST_BENCHMARKS['ipcc_lower_inr_per_kg']}"
            f"-{COST_BENCHMARKS['ipcc_upper_inr_per_kg']}/kg)"
        )

    return {
        "emission_kg": emission_kg,
        "total_cost_inr": total_cost_inr,
        "total_trees": result["total_trees"],
        "det_offset_kg": round(det_offset, 1),
        "mc_mean_offset_kg": round(mc_offset, 1),
        "mc_p5_offset_kg": round(p5_offset, 1),
        "cost_per_kg_deterministic": round(cost_per_kg_det, 4),
        "cost_per_kg_mc_mean": round(cost_per_kg_mc, 4),
        "cost_per_kg_p5_conservative": round(cost_per_kg_p5, 4),
        "in_ipcc_range": in_ipcc_range,
        "in_acceptable_range": in_acceptable_range,
        "flags": flags,
    }


def run_cost_realism() -> Dict:
    """Run cost realism checks across multiple scenarios."""
    scenarios = [
        (500, "India", 20),
        (1000, "India", 20),
        (5000, "India", 20),
        (1000, "India_arid", 20),
        (1000, "India_tropical", 20),
    ]

    results = []
    all_acceptable = True

    for emission, location, horizon in scenarios:
        result = compute_cost_per_kg(emission, location, horizon)
        results.append(result)
        if not result["in_acceptable_range"]:
            all_acceptable = False

    return {
        "metric": "cost_realism",
        "benchmarks": COST_BENCHMARKS,
        "all_in_acceptable_range": all_acceptable,
        "target": "All costs within ₹0.1-15.0/kg CO2",
        "passed": all_acceptable,
        "scenarios": results,
    }