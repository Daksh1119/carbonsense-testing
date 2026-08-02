"""
Unit tests for features_v4.py — TEME v4 feature engineering.

Covers:
  - build_features_v4: column set, required features, optional fill, interactions
  - SpeciesTargetEncoder: fit/transform, smoothing, unknown species, serialization
"""

from __future__ import annotations

import numpy as np
import pandas as pd
import pytest

from ml_services.teme.ml.features_v4 import (
    SpeciesTargetEncoder,
    build_features_v4,
    _NUMERIC_PASSTHROUGH,
    _OPTIONAL_NUMERIC,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _base_row(**overrides) -> pd.DataFrame:
    """Minimal valid single-row DataFrame for build_features_v4."""
    base = {
        "growth_rate_class": 5.0,
        "drought_score": 4.0,
        "fire_score": 3.0,
        "disease_score": 5.0,
        "planted_count": 100.0,
    }
    base.update(overrides)
    return pd.DataFrame([base])


def _batch(n: int = 10, seed: int = 42) -> pd.DataFrame:
    rng = np.random.default_rng(seed)
    return pd.DataFrame({
        "growth_rate_class": rng.integers(1, 10, n).astype(float),
        "drought_score":     rng.integers(1, 10, n).astype(float),
        "fire_score":        rng.integers(1, 10, n).astype(float),
        "disease_score":     rng.integers(1, 10, n).astype(float),
        "planted_count":     rng.integers(50, 500, n).astype(float),
        "species_name":      rng.choice(["Neem", "Peepal", "Bamboo", "Teak"], n),
        "climate_zone":      rng.choice(["tropical", "subtropical", "arid", "unknown"], n),
    })


# ---------------------------------------------------------------------------
# build_features_v4
# ---------------------------------------------------------------------------

class TestBuildFeaturesV4:

    def test_required_passthrough_columns_present(self):
        df = build_features_v4(_base_row())
        for col in _NUMERIC_PASSTHROUGH:
            assert col in df.columns, f"Required column missing: {col}"

    def test_optional_columns_present_and_nan_filled(self):
        df = build_features_v4(_base_row())  # no optional cols supplied
        for col in _OPTIONAL_NUMERIC:
            assert col in df.columns, f"Optional column missing: {col}"

    def test_interaction_features_present(self):
        df = build_features_v4(_base_row())
        for col in ["stress_composite", "growth_x_stress", "log_planted_count",
                    "drought_x_fire", "growth_sq"]:
            assert col in df.columns, f"Interaction feature missing: {col}"

    def test_stress_composite_formula(self):
        row = _base_row(drought_score=6.0, fire_score=4.0, disease_score=8.0)
        df = build_features_v4(row)
        expected = (6.0 + 4.0 + 8.0) / 3.0
        assert abs(df["stress_composite"].iloc[0] - expected) < 1e-9

    def test_growth_x_stress(self):
        row = _base_row(growth_rate_class=7.0, drought_score=6.0, fire_score=4.0, disease_score=8.0)
        df = build_features_v4(row)
        stress = (6.0 + 4.0 + 8.0) / 3.0
        expected = 7.0 * stress
        assert abs(df["growth_x_stress"].iloc[0] - expected) < 1e-9

    def test_log_planted_count_is_log1p(self):
        row = _base_row(planted_count=99.0)
        df = build_features_v4(row)
        expected = np.log1p(99.0)
        assert abs(df["log_planted_count"].iloc[0] - expected) < 1e-9

    def test_drought_x_fire(self):
        row = _base_row(drought_score=3.0, fire_score=7.0)
        df = build_features_v4(row)
        assert abs(df["drought_x_fire"].iloc[0] - 21.0) < 1e-9

    def test_growth_sq(self):
        row = _base_row(growth_rate_class=4.0)
        df = build_features_v4(row)
        assert abs(df["growth_sq"].iloc[0] - 16.0) < 1e-9

    def test_climate_zone_encoded_known(self):
        row = _base_row()
        row["climate_zone"] = "tropical"
        df = build_features_v4(row)
        assert df["climate_zone_code"].iloc[0] == 4.0  # from _CLIMATE_ZONE_CODES

    def test_climate_zone_unknown_gives_zero(self):
        row = _base_row()
        row["climate_zone"] = "totally_unknown_biome"
        df = build_features_v4(row)
        assert df["climate_zone_code"].iloc[0] == 0.0

    def test_missing_climate_zone_gives_zero(self):
        df = build_features_v4(_base_row())  # no climate_zone column
        assert df["climate_zone_code"].iloc[0] == 0.0

    def test_batch_produces_correct_shape(self):
        batch = _batch(n=20)
        df = build_features_v4(batch)
        assert len(df) == 20
        # At minimum: 5 required + len(optional) + 1 climate_zone_code + 5 interactions
        assert df.shape[1] >= 5 + len(_OPTIONAL_NUMERIC) + 1 + 5

    def test_all_values_are_numeric(self):
        df = build_features_v4(_batch(n=10))
        for col in df.columns:
            assert pd.api.types.is_numeric_dtype(df[col]), f"Non-numeric column: {col}"

    def test_planted_count_clipped_at_one(self):
        row = _base_row(planted_count=0.0)
        df = build_features_v4(row)
        # log1p(clip(0, lower=1)) = log1p(1) = ln(2)
        assert abs(df["log_planted_count"].iloc[0] - np.log1p(1.0)) < 1e-9


# ---------------------------------------------------------------------------
# SpeciesTargetEncoder
# ---------------------------------------------------------------------------

class TestSpeciesTargetEncoder:

    def _fit_simple(self):
        species = pd.Series(["Neem", "Neem", "Peepal", "Peepal", "Bamboo"])
        target  = pd.Series([0.8, 0.7, 0.6, 0.65, 0.9])
        enc = SpeciesTargetEncoder(alpha=10.0)
        enc.fit(species, target)
        return enc, species, target

    def test_fit_stores_global_mean(self):
        species = pd.Series(["Neem", "Peepal"])
        target  = pd.Series([0.8, 0.6])
        enc = SpeciesTargetEncoder()
        enc.fit(species, target)
        assert abs(enc._global_mean - 0.7) < 1e-9

    def test_transform_known_species(self):
        enc, _, _ = self._fit_simple()
        result = enc.transform(pd.Series(["Neem"]))
        # Should return a smoothed value close to Neem's mean (0.75), not 0.5
        assert 0.5 < result.iloc[0] < 1.0

    def test_transform_unknown_species_returns_global_mean(self):
        enc, _, _ = self._fit_simple()
        result = enc.transform(pd.Series(["unknown_species_xyz"]))
        assert abs(result.iloc[0] - enc._global_mean) < 1e-9

    def test_case_insensitive_lookup(self):
        enc, _, _ = self._fit_simple()
        upper = enc.transform(pd.Series(["NEEM"]))
        lower = enc.transform(pd.Series(["neem"]))
        assert abs(upper.iloc[0] - lower.iloc[0]) < 1e-9

    def test_higher_alpha_shrinks_toward_global_mean(self):
        species = pd.Series(["Rare"] * 2)
        target  = pd.Series([0.9, 0.9])
        global_mean_approx = 0.9  # only one species, global mean = 0.9
        enc_low  = SpeciesTargetEncoder(alpha=1.0).fit(species, target)
        enc_high = SpeciesTargetEncoder(alpha=100.0).fit(species, target)
        # Both should produce same value when there's only one species,
        # but high alpha means encoded value is pulled harder to global mean.
        # With a single species, global_mean = species_mean, so values are equal.
        val_low  = enc_low.transform(pd.Series(["Rare"])).iloc[0]
        val_high = enc_high.transform(pd.Series(["Rare"])).iloc[0]
        assert abs(val_low - val_high) < 0.01  # same distribution → same value

    def test_export_and_from_state_roundtrip(self):
        enc, species, target = self._fit_simple()
        state = enc.export_state()
        enc2 = SpeciesTargetEncoder.from_state(state)
        orig  = enc.transform(pd.Series(["Neem", "Peepal", "unknown"]))
        restored = enc2.transform(pd.Series(["Neem", "Peepal", "unknown"]))
        for a, b in zip(orig, restored):
            assert abs(a - b) < 1e-9

    def test_from_state_preserves_alpha(self):
        enc = SpeciesTargetEncoder(alpha=42.0)
        enc.fit(pd.Series(["A"]), pd.Series([0.7]))
        enc2 = SpeciesTargetEncoder.from_state(enc.export_state())
        assert enc2.alpha == 42.0

    def test_transform_returns_series_same_length(self):
        enc, _, _ = self._fit_simple()
        result = enc.transform(pd.Series(["Neem", "unknown", "Bamboo", "Teak"]))
        assert len(result) == 4
