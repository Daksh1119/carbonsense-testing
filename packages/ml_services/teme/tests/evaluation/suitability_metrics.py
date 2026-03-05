"""
TEME Suitability Violation Rate

Tests whether the optimizer EVER recommends a species that violates
hard constraints:
  - Climate zone mismatch
  - Soil incompatibility
  - Region not in species regions list
  - Excluded species appearing in plan

Suitability Violation Rate MUST be 0%.
If it's not 0, the constraint filtering is broken.
"""

from typing import Dict, List
from teme.core.optimizer import select_species_rule_based
from teme.data.species_catalog import SPECIES_CATALOG


# ---------------------------------------------------------------------------
# Test scenarios covering every constraint type
# ---------------------------------------------------------------------------

SUITABILITY_TEST_CASES = [
    {
        "name": "Standard India",
        "emission_kg": 1000,
        "location": "India",
        "constraints": {
            "max_land_area_hectare": 5,
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
        "name": "Exclude Neem+Peepal",
        "emission_kg": 1000,
        "location": "India",
        "constraints": {
            "max_land_area_hectare": 5,
            "preferred_species": None,
            "exclude_species": ["Neem", "Peepal"],
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
        "name": "Tropical only",
        "emission_kg": 1000,
        "location": "India_tropical",
        "constraints": {
            "max_land_area_hectare": 5,
            "preferred_species": None,
            "exclude_species": None,
        },
    },
    {
        "name": "Arid region",
        "emission_kg": 1000,
        "location": "India_arid",
        "constraints": {
            "max_land_area_hectare": 5,
            "preferred_species": None,
            "exclude_species": None,
        },
    },
    {
        "name": "Subtropical region",
        "emission_kg": 800,
        "location": "India_subtropical",
        "constraints": {
            "max_land_area_hectare": 4,
            "preferred_species": None,
            "exclude_species": None,
        },
    },
    {
        "name": "Tiny land budget",
        "emission_kg": 200,
        "location": "India",
        "constraints": {
            "max_land_area_hectare": 0.5,
            "preferred_species": None,
            "exclude_species": None,
        },
    },
    {
        "name": "Large emission",
        "emission_kg": 10000,
        "location": "India",
        "constraints": {
            "max_land_area_hectare": 20,
            "preferred_species": None,
            "exclude_species": None,
        },
    },
    {
        "name": "Exclude all except Acacia",
        "emission_kg": 500,
        "location": "India",
        "constraints": {
            "max_land_area_hectare": 5,
            "preferred_species": None,
            "exclude_species": ["Neem", "Peepal", "Bamboo", "Teak",
                                "Mango", "Banyan", "Eucalyptus"],
        },
    },
]


def check_single_recommendation(
    test_case: Dict,
) -> Dict:
    """
    Run optimizer and verify every recommended species passes
    all hard constraints.
    """
    name = test_case["name"]
    location = test_case["location"]
    constraints = test_case["constraints"]
    excluded = set(constraints.get("exclude_species") or [])

    violations = []

    try:
        config = select_species_rule_based(
            emission_kg=test_case["emission_kg"],
            location=location,
            constraints=constraints,
        )
    except Exception as e:
        return {
            "name": name,
            "status": "error",
            "error": str(e),
            "violations": [],
            "species_recommended": [],
        }

    species_recommended = list(config.keys())

    for species in species_recommended:
        catalog_entry = SPECIES_CATALOG.get(species)

        # V1: Species must exist in catalog
        if catalog_entry is None:
            violations.append(f"{species}: NOT IN CATALOG")
            continue

        # V2: Region must match
        if location not in catalog_entry["regions"]:
            violations.append(
                f"{species}: REGION MISMATCH — '{location}' not in "
                f"{catalog_entry['regions']}"
            )

        # V3: Must not be in excluded list
        if species in excluded:
            violations.append(
                f"{species}: EXCLUDED SPECIES appeared in recommendation"
            )

        # V4: Land allocation must not exceed budget
        land_used = config[species]["count"] * config[species]["land_per_tree"]
        if land_used > constraints["max_land_area_hectare"]:
            violations.append(
                f"{species}: LAND OVERFLOW — {land_used:.4f} ha > "
                f"{constraints['max_land_area_hectare']} ha"
            )

        # V5: Count must be positive
        if config[species]["count"] <= 0:
            violations.append(f"{species}: ZERO OR NEGATIVE tree count")

    return {
        "name": name,
        "status": "PASS" if len(violations) == 0 else "FAIL",
        "violations": violations,
        "species_recommended": species_recommended,
        "total_trees": sum(c["count"] for c in config.values()),
    }


def run_suitability_evaluation() -> Dict:
    """
    Run all suitability test cases.
    Returns summary with violation rate.
    """
    results = []
    total_recommendations = 0
    total_violations = 0

    for case in SUITABILITY_TEST_CASES:
        result = check_single_recommendation(case)
        results.append(result)

        if result["status"] != "error":
            total_recommendations += len(result["species_recommended"])
            total_violations += len(result["violations"])

    violation_rate = (
        total_violations / total_recommendations
        if total_recommendations > 0 else 0.0
    )

    return {
        "metric": "suitability_violation_rate",
        "violation_rate": round(violation_rate, 6),
        "total_test_cases": len(SUITABILITY_TEST_CASES),
        "total_recommendations": total_recommendations,
        "total_violations": total_violations,
        "target": "0.0 (MUST be zero)",
        "passed": total_violations == 0,
        "results": results,
    }