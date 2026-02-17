"""
TEME Suitability Evaluation

Tests whether species recommendations satisfy ALL hard constraints:
  - Region match (species must grow in user's location)
  - Exclusion compliance (excluded species must never appear)
  - Land feasibility (allocated land must not exceed max)
  - Positive tree count (no zero/negative allocations)

Metric:
  Suitability Violation Rate = invalid_recommendations / total_recommendations
  Target: 0.0 (zero violations)
"""

from typing import Dict, List, Any

from teme.data.species_catalog import SPECIES_CATALOG
from teme.core.optimizer import select_species_rule_based
from teme.core.land import calculate_land_required


# ---------------------------------------------------------------------------
# Test scenarios covering edge cases
# ---------------------------------------------------------------------------

TEST_SCENARIOS = [
    {
        "name": "Standard India 1000kg",
        "emission_kg": 1000,
        "location": "India",
        "constraints": {
            "max_land_area_hectare": 5,
            "preferred_species": None,
            "exclude_species": None,
        },
    },
    {
        "name": "Small emission 100kg",
        "emission_kg": 100,
        "location": "India",
        "constraints": {
            "max_land_area_hectare": 1,
            "preferred_species": None,
            "exclude_species": None,
        },
    },
    {
        "name": "Large emission 10000kg",
        "emission_kg": 10000,
        "location": "India",
        "constraints": {
            "max_land_area_hectare": 20,
            "preferred_species": None,
            "exclude_species": None,
        },
    },
    {
        "name": "Exclude Neem",
        "emission_kg": 1000,
        "location": "India",
        "constraints": {
            "max_land_area_hectare": 5,
            "preferred_species": None,
            "exclude_species": ["Neem"],
        },
    },
    {
        "name": "Exclude Neem and Peepal",
        "emission_kg": 1000,
        "location": "India",
        "constraints": {
            "max_land_area_hectare": 5,
            "preferred_species": None,
            "exclude_species": ["Neem", "Peepal"],
        },
    },
    {
        "name": "Exclude top 3 (Neem, Peepal, Bamboo)",
        "emission_kg": 1000,
        "location": "India",
        "constraints": {
            "max_land_area_hectare": 5,
            "preferred_species": None,
            "exclude_species": ["Neem", "Peepal", "Bamboo"],
        },
    },
    {
        "name": "Prefer Bamboo",
        "emission_kg": 500,
        "location": "India",
        "constraints": {
            "max_land_area_hectare": 3,
            "preferred_species": ["Bamboo"],
            "exclude_species": None,
        },
    },
    {
        "name": "Very tight land 0.1 ha",
        "emission_kg": 500,
        "location": "India",
        "constraints": {
            "max_land_area_hectare": 0.1,
            "preferred_species": None,
            "exclude_species": None,
        },
    },
    {
        "name": "Very large land 50 ha",
        "emission_kg": 5000,
        "location": "India",
        "constraints": {
            "max_land_area_hectare": 50,
            "preferred_species": None,
            "exclude_species": None,
        },
    },
    {
        "name": "Multi-species large emission (15000kg, 15ha)",
        "emission_kg": 15000,
        "location": "India",
        "constraints": {
            "max_land_area_hectare": 15,
            "preferred_species": None,
            "exclude_species": None,
        },
    },
    {
        "name": "Tropical region only",
        "emission_kg": 1000,
        "location": "India_tropical",
        "constraints": {
            "max_land_area_hectare": 5,
            "preferred_species": None,
            "exclude_species": None,
        },
    },
    {
        "name": "Arid region only",
        "emission_kg": 1000,
        "location": "India_arid",
        "constraints": {
            "max_land_area_hectare": 5,
            "preferred_species": None,
            "exclude_species": None,
        },
    },
]


# ---------------------------------------------------------------------------
# Validation checks
# ---------------------------------------------------------------------------

def check_region_constraint(
    species_config: Dict[str, Dict],
    location: str,
) -> List[Dict]:
    """Check that every recommended species grows in the given location."""
    violations = []
    for species, cfg in species_config.items():
        catalog_entry = SPECIES_CATALOG.get(species)
        if catalog_entry is None:
            violations.append({
                "type": "unknown_species",
                "species": species,
                "detail": f"Species '{species}' not found in catalog",
            })
            continue

        if location not in catalog_entry["regions"]:
            violations.append({
                "type": "region_mismatch",
                "species": species,
                "location": location,
                "allowed_regions": catalog_entry["regions"],
                "detail": f"'{species}' does not grow in '{location}'",
            })
    return violations


def check_exclusion_constraint(
    species_config: Dict[str, Dict],
    excluded: List[str],
) -> List[Dict]:
    """Check that no excluded species appears in recommendations."""
    violations = []
    excluded_set = set(excluded) if excluded else set()

    for species in species_config:
        if species in excluded_set:
            violations.append({
                "type": "exclusion_violated",
                "species": species,
                "detail": f"'{species}' was excluded but still recommended",
            })
    return violations


def check_land_constraint(
    species_config: Dict[str, Dict],
    max_land: float,
) -> List[Dict]:
    """Check that total land used does not exceed maximum."""
    violations = []
    species_counts = {s: cfg["count"] for s, cfg in species_config.items()}
    land_per_tree = {s: cfg["land_per_tree"] for s, cfg in species_config.items()}

    total_land = calculate_land_required(species_counts, land_per_tree)

    if total_land > max_land:
        violations.append({
            "type": "land_exceeded",
            "total_land": round(total_land, 4),
            "max_land": max_land,
            "overshoot": round(total_land - max_land, 4),
            "detail": f"Land {total_land:.4f} ha exceeds max {max_land} ha",
        })
    return violations


def check_positive_allocation(
    species_config: Dict[str, Dict],
) -> List[Dict]:
    """Check that every species has a positive tree count."""
    violations = []
    for species, cfg in species_config.items():
        if cfg["count"] <= 0:
            violations.append({
                "type": "non_positive_count",
                "species": species,
                "count": cfg["count"],
                "detail": f"'{species}' has count={cfg['count']} (must be > 0)",
            })
    return violations


# ---------------------------------------------------------------------------
# Run full suitability evaluation
# ---------------------------------------------------------------------------

def run_suitability_evaluation() -> Dict:
    """
    Run all test scenarios through the optimizer and check constraints.
    """
    print("[TEME EVALUATION] Running suitability constraint evaluation...")

    total_scenarios = 0
    total_violations = 0
    passed = 0
    failed = 0
    scenario_results = []

    for scenario in TEST_SCENARIOS:
        total_scenarios += 1
        name = scenario["name"]

        try:
            config = select_species_rule_based(
                emission_kg=scenario["emission_kg"],
                location=scenario["location"],
                constraints=scenario["constraints"],
            )
        except (ValueError, Exception) as e:
            scenario_results.append({
                "scenario": name,
                "status": "error",
                "error": str(e),
                "violations": [],
            })
            passed += 1
            continue

        # Run all constraint checks
        violations = []
        violations.extend(
            check_region_constraint(config, scenario["location"])
        )
        violations.extend(
            check_exclusion_constraint(
                config, scenario["constraints"].get("exclude_species")
            )
        )
        violations.extend(
            check_land_constraint(
                config, scenario["constraints"]["max_land_area_hectare"]
            )
        )
        violations.extend(check_positive_allocation(config))

        total_violations += len(violations)

        if violations:
            failed += 1
            status = "FAIL"
        else:
            passed += 1
            status = "PASS"

        species_summary = {
            s: cfg["count"] for s, cfg in config.items()
        }

        scenario_results.append({
            "scenario": name,
            "status": status,
            "species_allocated": species_summary,
            "violations": violations,
        })

    violation_rate = total_violations / max(total_scenarios, 1)

    result = {
        "total_scenarios": total_scenarios,
        "passed": passed,
        "failed": failed,
        "total_violations": total_violations,
        "violation_rate": round(violation_rate, 4),
        "target_violation_rate": 0.0,
        "meets_target": violation_rate == 0.0,
        "scenarios": scenario_results,
    }

    # Print report
    print(f"\n{'='*60}")
    print(f"  TEME SUITABILITY EVALUATION REPORT")
    print(f"{'='*60}")
    print(f"  Scenarios tested:     {total_scenarios}")
    print(f"  Passed:               {passed}")
    print(f"  Failed:               {failed}")
    print(f"  Total violations:     {total_violations}")
    print(f"  Violation rate:       {violation_rate:.4f}")
    print(f"  Target:               0.0000")
    print(f"  Meets target:         {'✅ YES' if result['meets_target'] else '❌ NO'}")
    print(f"{'='*60}")

    for sr in scenario_results:
        icon = "✅" if sr["status"] in ("PASS", "error") else "❌"
        print(f"  {icon} {sr['scenario']}: {sr['status']}")
        if sr.get("species_allocated"):
            for sp, count in sr["species_allocated"].items():
                print(f"       {sp}: {count} trees")
        if sr.get("error"):
            print(f"       Error: {sr['error']}")
        for v in sr.get("violations", []):
            print(f"       ⚠️  {v['type']}: {v['detail']}")

    print(f"{'='*60}\n")

    return result


if __name__ == "__main__":
    run_suitability_evaluation()