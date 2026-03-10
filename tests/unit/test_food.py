"""
tests/unit/test_food.py
───────────────────────
Unit tests for the food recognition carbon DB and inference API.
Tests here do NOT require model checkpoints — they test
food_carbon_db in isolation.

Run with:
    python -m pytest tests/unit/test_food.py -v
"""
import sys
from pathlib import Path

import pytest

ROOT_DIR     = Path(__file__).resolve().parents[2]
PACKAGES_DIR = ROOT_DIR / "packages"
if str(PACKAGES_DIR) not in sys.path:
    sys.path.insert(0, str(PACKAGES_DIR))

from packages.ml_services.food.food_carbon_db import (
    get_carbon,
    FOOD101_CARBON,
    INDIAN_FOOD_CARBON,
    DEFAULT_CARBON,
)


class TestFoodCarbonDb:
    def test_known_food101_item_returns_correct_value(self):
        assert get_carbon("beef_tartare") == pytest.approx(2.50, abs=0.01)

    def test_known_indian_item_returns_correct_value(self):
        assert get_carbon("biryani") == pytest.approx(0.75, abs=0.01)

    def test_unknown_item_returns_default(self):
        assert get_carbon("xyzzy_mystery_food") == DEFAULT_CARBON

    def test_case_insensitive_lookup(self):
        assert get_carbon("Biryani") == get_carbon("biryani")

    def test_space_to_underscore_normalised(self):
        assert get_carbon("butter chicken") == get_carbon("butter_chicken")

    def test_all_food101_values_positive(self):
        for key, val in FOOD101_CARBON.items():
            assert val > 0, f"{key} has non-positive carbon value"

    def test_all_indian_values_positive(self):
        for key, val in INDIAN_FOOD_CARBON.items():
            assert val > 0, f"{key} has non-positive carbon value"

    def test_beef_higher_than_vegetarian(self):
        """Beef must have higher carbon than edamame — basic sanity check."""
        assert get_carbon("beef_tartare") > get_carbon("edamame")

    def test_idli_mapped(self):
        assert get_carbon("idli") < DEFAULT_CARBON

    def test_dosa_mapped(self):
        assert get_carbon("dosa") < DEFAULT_CARBON

    def test_butter_chicken_mapped(self):
        assert get_carbon("butter_chicken") > 0

    def test_dal_makhani_mapped(self):
        assert get_carbon("dal_makhani") > 0

    def test_default_carbon_is_reasonable(self):
        """Default fallback must be in a sane range."""
        assert 0.1 < DEFAULT_CARBON < 5.0

    def test_foie_gras_is_highest_food101(self):
        assert get_carbon("foie_gras") == max(FOOD101_CARBON.values())

    def test_mutton_curry_higher_than_dal(self):
        assert get_carbon("mutton_curry") > get_carbon("dal_makhani")

    def test_indian_db_does_not_override_food101_samosa(self):
        """samosa appears in both DBs — ALL_CARBON_DB merge should be stable."""
        val = get_carbon("samosa")
        assert val > 0

    def test_serving_carbon_calculation(self):
        """250g of biryani = biryani_per_100g * 2.5."""
        per_100g  = get_carbon("biryani")
        per_250g  = per_100g * 2.5
        assert per_250g == pytest.approx(0.75 * 2.5, abs=0.001)
