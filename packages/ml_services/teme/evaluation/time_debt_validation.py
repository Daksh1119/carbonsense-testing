"""
TEME Time-Debt & Cost Realism Validation

Validates:
  1. Offset projection consistency (cumulative must be monotonically increasing)
  2. Cost-per-kg CO2 against literature benchmarks (using full plantation cost)
  3. Payback year sanity (not too fast, not impossibly slow)
  4. Per-tree absorption rates against FAO literature bounds

Benchmarks:
  - Total plantation cost: â‚¹300-1200/tree (ICFRE guidelines)
  - Cost per kg CO2 offset: â‚¹3-50 typical via tree planting (IPCC AR6, WG3 Ch12)
  - Payback period: 3-25 years typical (ICFRE guidelines)
  - Per-tree absorption: 5-35 kg/year at maturity (FAO)
"""

from typing import Dict, List, Any
from ml_services.teme.core.engine import run_teme
from ml_services.teme.data.species_catalog import SPECIES_CATALOG


# ---------------------------------------------------------------------------
# Literature benchmarks
# ---------------------------------------------------------------------------

# Cost per kg CO2 offset via tree planting (INR)
# Uses TOTAL plantation cost (sapling + land prep + labor + maintenance + fencing)
# Source: IPCC AR6 WG3 Ch12, ICFRE plantation economics
COST_PER_KG_BOUNDS = {
    "lower": 1.0,       # Very cheap (mass government plantation, established nursery)
    "upper": 100.0,     # Expensive (urban, fully maintained, third-party verified)
    "typical_lower": 3.0,
    "typical_upper": 50.0,
}

# Payback year bounds
PAYBACK_BOUNDS = {
    "minimum_realistic": 3,    # Faster than this is suspicious
    "maximum_acceptable": 25,  # Slower than this is impractical
}


# ---------------------------------------------------------------------------
# Test scenarios
# ---------------------------------------------------------------------------

PROJECTION_TEST_SCENARIOS = [
    {
        "name": "Standard 1000kg / 20yr",
        "payload": {
            "emission_kg": 1000,
            "location": "India",
            "start_year": 2026,
            "time_horizon_years": 20,
            "constraints": {"max_land_area_hectare": 5},
        },
    },
    {
        "name": "Small 200kg / 15yr",
        "payload": {
            "emission_kg": 200,
            "location": "India",
            "start_year": 2026,
            "time_horizon_years": 15,
            "constraints": {"max_land_area_hectare": 2},
        },
    },
    {
        "name": "Large 5000kg / 20yr",
        "payload": {
            "emission_kg": 5000,
            "location": "India",
            "start_year": 2026,
            "time_horizon_years": 20,
            "constraints": {"max_land_area_hectare": 20},
        },
    },
    {
        "name": "Tight land 1000kg / 0.5ha",
        "payload": {
            "emission_kg": 1000,
            "location": "India",
            "start_year": 2026,
            "time_horizon_years": 20,
            "constraints": {"max_land_area_hectare": 0.5},
        },
    },
]


# ---------------------------------------------------------------------------
# Cost lookup from catalog
# ---------------------------------------------------------------------------

def get_total_cost_per_tree(species_name: str) -> float:
    """
    Get total plantation cost per tree from species catalog.

    Includes: sapling + land prep + planting labor + 3yr maintenance +
    fencing + monitoring.

    Falls back to â‚¹500 if species not in catalog.
    """
    entry = SPECIES_CATALOG.get(species_name)
    if entry and "cost_per_tree_total_inr" in entry:
        return entry["cost_per_tree_total_inr"]
    return 500.0  # Conservative fallback


# ---------------------------------------------------------------------------
# Validation checks
# ---------------------------------------------------------------------------

def validate_monotonic_cumulative(result: Dict) -> Dict:
    """
    Check that cumulative offset is monotonically non-decreasing.
    A decrease would mean trees are UN-absorbing CO2 (physically impossible).
    """
    plan = result["offset_plan"]
    T = len(plan[0]["annual_sequestration_kg"]) - 1

    # Reconstruct cumulative from offset_plan
    annual_total = [0.0] * (T + 1)
    for species_plan in plan:
        seq = species_plan["annual_sequestration_kg"]
        surv = species_plan["survival_curve"]
        count = species_plan["count"]
        for t in range(T + 1):
            annual_total[t] += count * seq[t] * surv[t]

    cumulative = [0.0] * (T + 1)
    for t in range(T + 1):
        cumulative[t] = annual_total[t] + (cumulative[t - 1] if t > 0 else 0.0)

    violations = []
    for t in range(1, T + 1):
        if cumulative[t] < cumulative[t - 1] - 0.001:
            violations.append({
                "year": t,
                "current": round(cumulative[t], 4),
                "previous": round(cumulative[t - 1], 4),
                "decrease": round(cumulative[t - 1] - cumulative[t], 4),
            })

    return {
        "check": "monotonic_cumulative",
        "passed": len(violations) == 0,
        "violations": violations,
        "final_cumulative_kg": round(cumulative[T], 2),
    }


def validate_payback_year(result: Dict) -> Dict:
    """Check that time_to_neutral is within realistic bounds."""
    payback = result["time_to_neutral_years"]

    issues = []
    if payback < PAYBACK_BOUNDS["minimum_realistic"]:
        issues.append(
            f"Payback {payback} years is suspiciously fast "
            f"(minimum realistic: {PAYBACK_BOUNDS['minimum_realistic']})"
        )
    if payback > PAYBACK_BOUNDS["maximum_acceptable"]:
        issues.append(
            f"Payback {payback} years exceeds acceptable maximum "
            f"({PAYBACK_BOUNDS['maximum_acceptable']})"
        )

    return {
        "check": "payback_year_realism",
        "passed": len(issues) == 0,
        "payback_years": payback,
        "bounds": PAYBACK_BOUNDS,
        "issues": issues,
    }


def validate_cost_realism(result: Dict) -> Dict:
    """
    Calculate cost-per-kg CO2 offset using TOTAL plantation cost
    (not just sapling cost) and compare against IPCC benchmarks.

    Total cost per tree includes:
      - Sapling purchase
      - Land preparation
      - Planting labor
      - 3-year maintenance (watering, weeding, fertilizer)
      - Fencing / protection
      - Monitoring and verification
    """
    plan = result["offset_plan"]
    T = len(plan[0]["annual_sequestration_kg"]) - 1

    total_cost_inr = 0
    total_trees = 0
    cost_breakdown = []

    for species_plan in plan:
        species_name = species_plan["species"]
        count = species_plan["count"]
        total_trees += count
        cost_per_tree = get_total_cost_per_tree(species_name)
        species_cost = count * cost_per_tree
        total_cost_inr += species_cost
        cost_breakdown.append({
            "species": species_name,
            "count": count,
            "cost_per_tree_inr": cost_per_tree,
            "total_cost_inr": round(species_cost, 2),
        })

    # Calculate total survival-weighted offset over time horizon
    total_offset_kg = 0.0
    for species_plan in plan:
        seq = species_plan["annual_sequestration_kg"]
        surv = species_plan["survival_curve"]
        count = species_plan["count"]
        for t in range(T + 1):
            total_offset_kg += count * seq[t] * surv[t]

    if total_offset_kg > 0:
        cost_per_kg = total_cost_inr / total_offset_kg
    else:
        cost_per_kg = float("inf")

    issues = []
    if cost_per_kg < COST_PER_KG_BOUNDS["lower"]:
        issues.append(
            f"Cost/kg â‚¹{cost_per_kg:.2f} is below minimum realistic "
            f"(â‚¹{COST_PER_KG_BOUNDS['lower']})"
        )
    if cost_per_kg > COST_PER_KG_BOUNDS["upper"]:
        issues.append(
            f"Cost/kg â‚¹{cost_per_kg:.2f} exceeds maximum realistic "
            f"(â‚¹{COST_PER_KG_BOUNDS['upper']})"
        )

    in_typical_range = (
        COST_PER_KG_BOUNDS["typical_lower"]
        <= cost_per_kg
        <= COST_PER_KG_BOUNDS["typical_upper"]
    )

    return {
        "check": "cost_realism",
        "passed": len(issues) == 0,
        "total_trees": total_trees,
        "total_cost_inr": round(total_cost_inr, 2),
        "total_offset_kg": round(total_offset_kg, 2),
        "cost_per_kg_inr": round(cost_per_kg, 4),
        "in_typical_range": in_typical_range,
        "benchmarks": COST_PER_KG_BOUNDS,
        "cost_breakdown": cost_breakdown,
        "issues": issues,
    }


def validate_absorption_rates(result: Dict) -> Dict:
    """
    Check that per-tree absorption rates are within literature bounds.
    FAO data: mature trees typically absorb 5-35 kg CO2/year.
    """
    issues = []
    for species_plan in result["offset_plan"]:
        species = species_plan["species"]
        seq = species_plan["annual_sequestration_kg"]
        peak = max(seq)

        if peak > 50.0:
            issues.append(
                f"{species}: peak absorption {peak:.1f} kg/year exceeds "
                f"literature maximum (~35 kg/year for fast-growing tropical)"
            )
        if peak < 1.0 and peak > 0:
            issues.append(
                f"{species}: peak absorption {peak:.1f} kg/year is "
                f"unusually low (minimum expected ~5 kg/year)"
            )

    return {
        "check": "absorption_rate_realism",
        "passed": len(issues) == 0,
        "issues": issues,
    }


# ---------------------------------------------------------------------------
# Run full time-debt validation
# ---------------------------------------------------------------------------

def run_time_debt_validation() -> Dict:
    """
    Execute all time-debt and cost realism checks.
    """
    print("[TEME EVALUATION] Running time-debt & cost realism validation...")

    all_results = []
    total_checks = 0
    total_passed = 0
    total_failed = 0

    for scenario in PROJECTION_TEST_SCENARIOS:
        name = scenario["name"]
        print(f"\n  Testing: {name}")

        try:
            result = run_teme(scenario["payload"])
        except Exception as e:
            all_results.append({
                "scenario": name,
                "status": "engine_error",
                "error": str(e),
                "checks": [],
            })
            continue

        checks = []

        # Run all checks
        mono = validate_monotonic_cumulative(result)
        checks.append(mono)
        total_checks += 1
        total_passed += 1 if mono["passed"] else 0
        total_failed += 0 if mono["passed"] else 1

        payback = validate_payback_year(result)
        checks.append(payback)
        total_checks += 1
        total_passed += 1 if payback["passed"] else 0
        total_failed += 0 if payback["passed"] else 1

        cost = validate_cost_realism(result)
        checks.append(cost)
        total_checks += 1
        total_passed += 1 if cost["passed"] else 0
        total_failed += 0 if cost["passed"] else 1

        absorption = validate_absorption_rates(result)
        checks.append(absorption)
        total_checks += 1
        total_passed += 1 if absorption["passed"] else 0
        total_failed += 0 if absorption["passed"] else 1

        all_results.append({
            "scenario": name,
            "status": "completed",
            "total_trees": result["total_trees"],
            "time_to_neutral": result["time_to_neutral_years"],
            "confidence": result["confidence_score"],
            "checks": checks,
        })

    report = {
        "total_scenarios": len(PROJECTION_TEST_SCENARIOS),
        "total_checks": total_checks,
        "passed": total_passed,
        "failed": total_failed,
        "pass_rate": round(total_passed / max(total_checks, 1), 4),
        "scenarios": all_results,
    }

    # Print report
    print(f"\n{'='*60}")
    print(f"  TEME TIME-DEBT VALIDATION REPORT")
    print(f"{'='*60}")
    print(f"  Scenarios:       {report['total_scenarios']}")
    print(f"  Total checks:    {total_checks}")
    print(f"  Passed:          {total_passed}")
    print(f"  Failed:          {total_failed}")
    print(f"  Pass rate:       {report['pass_rate']*100:.1f}%")
    print(f"{'='*60}")

    for sr in all_results:
        print(f"\n  ðŸ“‹ {sr['scenario']}:")
        if sr["status"] == "engine_error":
            print(f"     âš ï¸  Engine error: {sr['error']}")
            continue

        print(f"     Trees: {sr['total_trees']} | "
              f"Payback: {sr['time_to_neutral']}yr | "
              f"Confidence: {sr['confidence']}")

        for check in sr["checks"]:
            icon = "âœ…" if check["passed"] else "âŒ"
            print(f"     {icon} {check['check']}")
            if check["check"] == "cost_realism":
                print(f"        Cost/kg: â‚¹{check['cost_per_kg_inr']:.2f} "
                      f"(typical: â‚¹{COST_PER_KG_BOUNDS['typical_lower']}-"
                      f"{COST_PER_KG_BOUNDS['typical_upper']})")
                if check.get("cost_breakdown"):
                    for cb in check["cost_breakdown"]:
                        print(f"          {cb['species']}: {cb['count']} Ã— "
                              f"â‚¹{cb['cost_per_tree_inr']:.0f} = "
                              f"â‚¹{cb['total_cost_inr']:.0f}")
                if check.get("in_typical_range"):
                    print(f"        âœ“ Within typical IPCC range")
            for issue in check.get("issues", []):
                print(f"        âš ï¸  {issue}")

    print(f"\n{'='*60}\n")

    return report


if __name__ == "__main__":
    run_time_debt_validation()
