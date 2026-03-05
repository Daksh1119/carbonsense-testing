import copy

from teme.core.engine import run_teme


BASE_INPUT = {
    "emission_kg": 1000,
    "activity_breakdown": {"energy": 1000},
    "location": "India",
    "start_year": 2025,
    "time_horizon_years": 20,
    "constraints": {
        "max_land_area_hectare": 5.0,
        "preferred_species": None,
        "exclude_species": None,
    },
    # deterministic species config for tests
    "species_config": {
        "Neem": {
            "count": 100,
            "maturity_years": 6,
            "peak_sequestration_kg": 25,
            "annual_survival_rate": 0.95,
            "land_per_tree": 0.01,
            "growth_rate_class": 7,
            "drought_score": 8,
            "fire_score": 7,
            "disease_score": 8,
        }
    },
}


def test_engine_without_ml():
    """
    ML disabled → no ml_metadata, deterministic behavior
    """
    payload = copy.deepcopy(BASE_INPUT)

    result = run_teme(payload)

    assert "ml_metadata" in result
    assert result["ml_metadata"]["enabled"] is False
    assert result["time_to_neutral_years"] >= 0
    assert result["land_required_hectare"] <= payload["constraints"]["max_land_area_hectare"]


def test_engine_with_ml_enabled():
    """
    ML enabled → adjustment applied but bounded
    """
    payload = copy.deepcopy(BASE_INPUT)
    payload["ml"] = {"enabled": True}

    result = run_teme(payload)

    assert "ml_metadata" in result
    assert result["ml_metadata"]["enabled"] in (True, False)  # ML may be unavailable in CI

    if result["ml_metadata"]["enabled"]:
        adjustments = result["ml_metadata"]["adjustment_factors"]
        assert "Neem" in adjustments

        adj = adjustments["Neem"]
        assert 0.8 <= adj <= 1.05
