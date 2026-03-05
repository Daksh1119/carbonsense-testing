"""
Quick integration test: engine.py with Monte Carlo enabled.
Run from packages/ml_services/teme/
"""

from teme.core.engine import run_teme


def test_deterministic_unchanged():
    """Verify deterministic output is identical with MC off."""
    payload = {
        "emission_kg": 1000,
        "location": "India",
        "start_year": 2026,
        "time_horizon_years": 20,
        "constraints": {"max_land_area_hectare": 5},
    }
    result = run_teme(payload)

    assert "monte_carlo" not in result, "MC should not be in output when not requested"
    assert result["time_to_neutral_years"] == 7
    assert result["confidence_score"] == 0.65
    print("âœ… Deterministic unchanged â€” no MC in output")


def test_mc_integration():
    """Verify MC block appears and has correct structure."""
    payload = {
        "emission_kg": 1000,
        "location": "India",
        "start_year": 2026,
        "time_horizon_years": 20,
        "constraints": {"max_land_area_hectare": 5},
        "monte_carlo": {
            "enabled": True,
            "n_simulations": 500,
            "seed": 42,
        },
    }
    result = run_teme(payload)

    # Deterministic still works
    assert result["time_to_neutral_years"] == 7
    print(f"  Deterministic payback: {result['time_to_neutral_years']}yr")

    # MC block present
    assert "monte_carlo" in result, "MC block missing"
    mc = result["monte_carlo"]

    assert "risk_aware_payback_years" in mc
    assert "probability_of_offset" in mc
    assert "curves" in mc
    assert "transparency" in mc

    print(f"  MC risk-aware payback: {mc['risk_aware_payback_years']}yr")
    print(f"  MC probability:       {mc['probability_of_offset']*100:.1f}%")
    print(f"  MC spread (P95-P5):   {mc['risk_metrics']['spread_p95_p5_kg']:.0f} kg")

    # Confidence upgraded to MC probability
    assert result["confidence_score"] == round(mc["probability_of_offset"], 2)
    print(f"  Confidence (upgraded): {result['confidence_score']}")

    # Curves have correct length
    T = 20
    assert len(mc["curves"]["mean"]) == T + 1
    assert len(mc["curves"]["p5"]) == T + 1
    assert len(mc["curves"]["deterministic"]) == T + 1
    print(f"  Curves length:         {len(mc['curves']['mean'])} (correct)")

    # Transparency metadata
    assert mc["transparency"]["model_version"] == "teme_mc_v1.0"
    assert mc["transparency"]["growth_model"] == "logistic"
    assert mc["transparency"]["payback_method"] == "5th_percentile_conservative"
    print(f"  Model version:         {mc['transparency']['model_version']}")

    print("âœ… MC integration verified â€” all fields present and correct")


def test_mc_warnings():
    """Verify risk-aware warnings are generated."""
    payload = {
        "emission_kg": 1000,
        "location": "India",
        "start_year": 2026,
        "time_horizon_years": 20,
        "constraints": {
            "max_land_area_hectare": 5,
            "exclude_species": ["Neem"],
        },
        "monte_carlo": {
            "enabled": True,
            "n_simulations": 500,
            "seed": 42,
        },
    }
    result = run_teme(payload)

    mc = result["monte_carlo"]
    det = result["time_to_neutral_years"]
    risk = mc["risk_aware_payback_years"]

    print(f"  Species: Peepal (Neem excluded)")
    print(f"  Deterministic: {det}yr | Risk-aware: {risk}yr")
    print(f"  Warnings: {result['warnings']}")

    has_risk_warning = any("Risk-aware" in w for w in result["warnings"])
    if risk and risk > det:
        assert has_risk_warning, "Should warn about risk-aware gap"
        print("âœ… Risk-aware warning correctly generated")
    else:
        print("âœ… No risk gap â€” no warning needed (correct)")


def test_api_output_shape():
    """Print the exact API output shape for documentation."""
    payload = {
        "emission_kg": 1000,
        "location": "India",
        "start_year": 2026,
        "time_horizon_years": 20,
        "constraints": {"max_land_area_hectare": 5},
        "monte_carlo": {"enabled": True, "n_simulations": 200, "seed": 42},
    }
    result = run_teme(payload)

    print(f"\n  API Output Keys (top level):")
    for key in result:
        val = result[key]
        if isinstance(val, dict):
            print(f"    {key}: dict ({len(val)} keys)")
            for k2 in val:
                print(f"      .{k2}")
        elif isinstance(val, list):
            print(f"    {key}: list ({len(val)} items)")
        else:
            print(f"    {key}: {val}")

    print("âœ… API output shape documented")


if __name__ == "__main__":
    print("\n" + "=" * 60)
    print("  TEME ENGINE + MONTE CARLO INTEGRATION TEST")
    print("=" * 60)

    print("\n--- Test 1: Deterministic unchanged ---")
    test_deterministic_unchanged()

    print("\n--- Test 2: MC integration ---")
    test_mc_integration()

    print("\n--- Test 3: MC warnings ---")
    test_mc_warnings()

    print("\n--- Test 4: API output shape ---")
    test_api_output_shape()

    print("\n" + "=" * 60)
    print("  ALL INTEGRATION TESTS PASSED")
    print("=" * 60 + "\n")
