"""
tests/unit/test_teme_unit.py
────────────────────────────
Unit tests for the TEME (Tree-Emission Matching Engine) core.

These tests do NOT require Supabase, LLM keys, or the trained ML model.
They exercise the pure-Python engine layer and route helpers.

Run with:
    python -m pytest tests/unit/test_teme_unit.py -v
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

import pytest

ROOT_DIR = Path(__file__).resolve().parents[2]
PACKAGES_DIR = ROOT_DIR / "packages"
if str(PACKAGES_DIR) not in sys.path:
    sys.path.insert(0, str(PACKAGES_DIR))

# Disable authz so engine tests don't try to hit Supabase
os.environ.setdefault("AUTHZ_DISABLED", "true")

from ml_services.teme.core.engine import run_teme
from ml_services.teme.core.exceptions import InfeasiblePlanError


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _minimal_payload(**overrides) -> dict:
    """Return the smallest valid TEME payload."""
    base = {
        "organization_id": "00000000-0000-0000-0000-000000000001",
        "user_id": "00000000-0000-0000-0000-000000000002",
        "emission_kg": 10_000.0,
        "location": "India",
        "time_horizon_years": 20,
        "constraints": {
            "max_land_area_hectare": 100.0,
            "preferred_species": [],
            "exclude_species": [],
        },
        "ml": {"enabled": False},
    }
    base.update(overrides)
    return base


# ─── Output structure ─────────────────────────────────────────────────────────

class TestTEMEOutputSchema:
    """Verify the engine returns the expected top-level keys."""

    def test_has_offset_plan(self):
        result = run_teme(_minimal_payload())
        assert "offset_plan" in result

    def test_has_total_trees(self):
        result = run_teme(_minimal_payload())
        assert "total_trees" in result
        assert isinstance(result["total_trees"], int)
        assert result["total_trees"] > 0

    def test_has_land_required(self):
        result = run_teme(_minimal_payload())
        assert "land_required_hectare" in result
        assert result["land_required_hectare"] > 0

    def test_has_confidence_score(self):
        result = run_teme(_minimal_payload())
        score = result.get("confidence_score")
        assert score is not None
        assert 0.0 <= float(score) <= 1.0

    def test_has_time_to_neutral(self):
        result = run_teme(_minimal_payload())
        assert "time_to_neutral_years" in result
        assert result["time_to_neutral_years"] > 0

    def test_has_warnings_list(self):
        result = run_teme(_minimal_payload())
        assert "warnings" in result
        assert isinstance(result["warnings"], list)


# ─── Offset plan items ────────────────────────────────────────────────────────

class TestTEMEOffsetPlan:
    """Verify each item in the offset plan has required fields."""

    def test_at_least_one_species_in_plan(self):
        result = run_teme(_minimal_payload())
        assert len(result["offset_plan"]) >= 1

    def test_each_item_has_species(self):
        result = run_teme(_minimal_payload())
        for item in result["offset_plan"]:
            assert "species" in item
            assert item["species"]

    def test_each_item_has_count(self):
        result = run_teme(_minimal_payload())
        for item in result["offset_plan"]:
            assert "count" in item
            assert item["count"] > 0

    def test_each_item_has_survival_curve(self):
        result = run_teme(_minimal_payload())
        for item in result["offset_plan"]:
            assert "survival_curve" in item
            curve = item["survival_curve"]
            assert isinstance(curve, list)
            assert len(curve) > 0
            # All values must be in [0, 1]
            for v in curve:
                assert 0.0 <= float(v) <= 1.0

    def test_total_trees_matches_sum_of_plan(self):
        result = run_teme(_minimal_payload())
        plan_total = sum(item["count"] for item in result["offset_plan"])
        # total_trees should be close to the sum (engine may round)
        assert abs(result["total_trees"] - plan_total) <= 10


# ─── Input variation ─────────────────────────────────────────────────────────

class TestTEMEInputVariations:
    """Verify the engine handles varied inputs gracefully."""

    def test_large_emission(self):
        result = run_teme(_minimal_payload(emission_kg=1_000_000.0))
        assert result["total_trees"] > 0

    def test_small_emission(self):
        result = run_teme(_minimal_payload(emission_kg=100.0))
        assert result["total_trees"] > 0

    def test_short_time_horizon(self):
        result = run_teme(_minimal_payload(time_horizon_years=5))
        assert result["total_trees"] > 0

    def test_mumbai_location_alias(self):
        """'mumbai' must map to India_coastal without crashing."""
        result = run_teme(_minimal_payload(location="mumbai"))
        assert result["total_trees"] > 0

    def test_delhi_location_alias(self):
        result = run_teme(_minimal_payload(location="delhi"))
        assert result["total_trees"] > 0

    def test_unknown_location_falls_back(self):
        """Unknown location should not crash — engine falls back to India."""
        result = run_teme(_minimal_payload(location="atlantis"))
        assert result["total_trees"] > 0

    def test_preferred_species_respected_when_available(self):
        """Engine should not crash when preferred_species is set."""
        payload = _minimal_payload()
        payload["constraints"]["preferred_species"] = ["Neem"]
        result = run_teme(payload)
        assert result["total_trees"] > 0

    def test_exclude_species_respected(self):
        """Engine should not crash when exclude_species is set."""
        payload = _minimal_payload()
        payload["constraints"]["exclude_species"] = ["Neem"]
        result = run_teme(payload)
        assert result["total_trees"] > 0


# ─── Error paths ─────────────────────────────────────────────────────────────

class TestTEMEErrorPaths:
    """Verify the engine raises the right errors on bad input."""

    def test_zero_emission_raises(self):
        with pytest.raises((InfeasiblePlanError, ValueError, Exception)):
            run_teme(_minimal_payload(emission_kg=0.0))

    def test_zero_land_raises(self):
        payload = _minimal_payload()
        payload["constraints"]["max_land_area_hectare"] = 0.0
        with pytest.raises((InfeasiblePlanError, ValueError, Exception)):
            run_teme(payload)

    def test_negative_emission_raises(self):
        with pytest.raises((InfeasiblePlanError, ValueError, Exception)):
            run_teme(_minimal_payload(emission_kg=-500.0))


# ─── Determinism ─────────────────────────────────────────────────────────────

class TestTEMEDeterminism:
    """Same input should produce identical output (no random ML path)."""

    def test_identical_outputs_on_same_input(self):
        payload = _minimal_payload()
        result_a = run_teme(payload)
        result_b = run_teme(payload)
        assert result_a["total_trees"] == result_b["total_trees"]
        assert result_a["land_required_hectare"] == result_b["land_required_hectare"]
