"""
TEME Edge Case Stress Tests

Deliberately breaks the system to verify graceful handling.
Every test case must NOT crash â€” must return error/fallback.
"""

from typing import Dict, List
from ml_services.teme.core.engine import run_teme
from ml_services.teme.core.exceptions import InfeasiblePlanError


EDGE_CASES = [
    {
        "name": "Negative emission",
        "payload": {
            "emission_kg": -100,
            "location": "India",
            "time_horizon_years": 20,
            "constraints": {"max_land_area_hectare": 5},
        },
        "expect": "error_or_empty",
    },
    {
        "name": "Zero emission",
        "payload": {
            "emission_kg": 0,
            "location": "India",
            "time_horizon_years": 20,
            "constraints": {"max_land_area_hectare": 5},
        },
        "expect": "error_or_zero",
    },
    {
        "name": "Extremely high emission (1M kg)",
        "payload": {
            "emission_kg": 1000000,
            "location": "India",
            "time_horizon_years": 20,
            "constraints": {"max_land_area_hectare": 5},
        },
        "expect": "infeasible_or_capped",
    },
    {
        "name": "Very small emission (0.1 kg)",
        "payload": {
            "emission_kg": 0.1,
            "location": "India",
            "time_horizon_years": 20,
            "constraints": {"max_land_area_hectare": 5},
        },
        "expect": "success_minimum_viable",
    },
    {
        "name": "Zero land area",
        "payload": {
            "emission_kg": 1000,
            "location": "India",
            "time_horizon_years": 20,
            "constraints": {"max_land_area_hectare": 0},
        },
        "expect": "error",
    },
    {
        "name": "Invalid location",
        "payload": {
            "emission_kg": 1000,
            "location": "Antarctica",
            "time_horizon_years": 20,
            "constraints": {"max_land_area_hectare": 5},
        },
        "expect": "error",
    },
    {
        "name": "All species excluded",
        "payload": {
            "emission_kg": 1000,
            "location": "India",
            "time_horizon_years": 20,
            "constraints": {
                "max_land_area_hectare": 5,
                "exclude_species": ["Neem", "Peepal", "Bamboo", "Teak",
                                    "Mango", "Banyan", "Eucalyptus", "Acacia"],
            },
        },
        "expect": "error",
    },
    {
        "name": "Time horizon = 1 year",
        "payload": {
            "emission_kg": 1000,
            "location": "India",
            "time_horizon_years": 1,
            "constraints": {"max_land_area_hectare": 5},
        },
        "expect": "infeasible",
    },
    {
        "name": "MC with 0 simulations",
        "payload": {
            "emission_kg": 1000,
            "location": "India",
            "time_horizon_years": 20,
            "constraints": {"max_land_area_hectare": 5},
            "monte_carlo": {"enabled": True, "n_simulations": 0},
        },
        "expect": "mc_error_or_fallback",
    },
]


def run_single_edge_case(case: Dict) -> Dict:
    """
    Run one edge case. Catches all exceptions.
    Success = did not crash unexpectedly.
    """
    name = case["name"]
    expect = case["expect"]

    try:
        result = run_teme(case["payload"])

        # Check for MC fallback
        mc = result.get("monte_carlo", {})
        mc_error = mc.get("error") if mc else None

        return {
            "name": name,
            "status": "completed",
            "crashed": False,
            "exception": None,
            "has_result": True,
            "mc_fallback": mc_error is not None,
            "time_to_neutral": result.get("time_to_neutral_years"),
            "total_trees": result.get("total_trees"),
            "expected": expect,
        }

    except (InfeasiblePlanError, ValueError) as e:
        return {
            "name": name,
            "status": "expected_error",
            "crashed": False,
            "exception": type(e).__name__,
            "exception_msg": str(e),
            "has_result": False,
            "expected": expect,
        }

    except Exception as e:
        return {
            "name": name,
            "status": "UNEXPECTED_CRASH",
            "crashed": True,
            "exception": type(e).__name__,
            "exception_msg": str(e),
            "has_result": False,
            "expected": expect,
        }


def run_edge_case_tests() -> Dict:
    """Run all edge case tests."""
    results = []
    crashes = 0

    for case in EDGE_CASES:
        result = run_single_edge_case(case)
        results.append(result)
        if result["crashed"]:
            crashes += 1

    return {
        "metric": "edge_case_hardening",
        "total_cases": len(EDGE_CASES),
        "crashes": crashes,
        "expected_errors": sum(
            1 for r in results if r["status"] == "expected_error"
        ),
        "completed": sum(
            1 for r in results if r["status"] == "completed"
        ),
        "target": "0 unexpected crashes",
        "passed": crashes == 0,
        "results": results,
    }
