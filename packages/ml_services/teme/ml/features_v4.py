"""
TEME v4 feature engineering.

Provides:
  - SpeciesTargetEncoder  : smoothed (James-Stein-style) target encoder for
                            species_name, using a configurable alpha that
                            shrinks rare species toward the global mean.
  - build_features_v4     : converts a raw dataframe row (or batch) into the
                            numeric feature matrix expected by the v4 model.
                            Species target encoding is NOT included here --
                            callers must add "species_target_enc" after calling
                            this function, so the encoder can be fit only on
                            training folds.
"""

from __future__ import annotations

from typing import Any

import numpy as np
import pandas as pd


# ---------------------------------------------------------------------------
# Species target encoder
# ---------------------------------------------------------------------------

class SpeciesTargetEncoder:
    """
    Smoothed target encoder for the species_name column.

    Formula:
        encoded(s) = (n_s * mean_s + alpha * global_mean) / (n_s + alpha)

    where n_s is the number of training rows for species s and mean_s is
    the mean target value for species s.  Alpha controls the shrinkage --
    higher alpha pulls rare species harder toward the global mean.
    """

    def __init__(self, alpha: float = 20.0) -> None:
        self.alpha = alpha
        self._species_map: dict[str, float] = {}
        self._global_mean: float = 0.5

    def fit(self, species: pd.Series, target: pd.Series) -> "SpeciesTargetEncoder":
        self._global_mean = float(target.mean())
        counts = species.groupby(species).transform("count")
        means = target.groupby(species).transform("mean")
        encoded = (counts * means + self.alpha * self._global_mean) / (counts + self.alpha)
        unique_species = species.unique()
        for sp in unique_species:
            mask = species == sp
            self._species_map[str(sp).lower().strip()] = float(encoded[mask].iloc[0])
        return self

    def transform(self, species: pd.Series) -> pd.Series:
        return species.apply(
            lambda s: self._species_map.get(str(s).lower().strip(), self._global_mean)
        )

    def export_state(self) -> dict[str, Any]:
        return {
            "species_map": dict(self._species_map),
            "global_mean": self._global_mean,
            "alpha": self.alpha,
        }

    @classmethod
    def from_state(cls, state: dict[str, Any]) -> "SpeciesTargetEncoder":
        enc = cls(alpha=state.get("alpha", 20.0))
        enc._species_map = {str(k): float(v) for k, v in state["species_map"].items()}
        enc._global_mean = float(state["global_mean"])
        return enc


# ---------------------------------------------------------------------------
# Feature matrix builder
# ---------------------------------------------------------------------------

_NUMERIC_PASSTHROUGH = [
    "growth_rate_class",
    "drought_score",
    "fire_score",
    "disease_score",
    "planted_count",
]

_OPTIONAL_NUMERIC = [
    "tree_age_years",
    "wood_density_gcm3",
    "management_score",
    "years_tracked",
    "soil_ph",
    "soil_organic_carbon_pct",
    "soil_clay_pct",
    "annual_rainfall_mm",
    "tmax_mean_c",
    "vpd_mean_hpa",
    "ndvi_at_planting",
    "planting_month",
    "elevation_m",
    "species_drought_tolerance",
    "region_drought_risk",
    "region_fire_risk",
    "region_disease_risk",
]

_CLIMATE_ZONE_CODES = {
    "tropical_peat_swamp_forest": 1,
    "tropical_forest_mineral_soil": 2,
    "unknown_tropicalasia": 3,
    "tropical": 4,
    "subtropical": 5,
    "temperate": 6,
    "boreal": 7,
    "arid": 8,
}


def _encode_climate_zone(series: pd.Series) -> pd.Series:
    return series.fillna("unknown").astype(str).str.lower().str.strip().map(
        lambda z: _CLIMATE_ZONE_CODES.get(z, 0)
    ).astype(float)


def build_features_v4(df: pd.DataFrame) -> pd.DataFrame:
    """
    Build the numeric feature DataFrame for TEME v4.

    Always produces the same column set regardless of which optional columns
    are present in df -- missing optional columns are filled with 0.0.
    The "species_target_enc" column is NOT included here; callers add it
    after fitting the SpeciesTargetEncoder on the training fold only.

    Parameters
    ----------
    df : pd.DataFrame
        Raw training or inference row(s). Must contain at minimum the four
        required columns: growth_rate_class, drought_score, fire_score,
        disease_score, planted_count.

    Returns
    -------
    pd.DataFrame
        Numeric feature matrix. All values are float; NaN / inf are NOT
        filled here -- callers are responsible for final cleanup.
    """
    out = pd.DataFrame(index=df.index)

    # --- Required numeric features ---
    for col in _NUMERIC_PASSTHROUGH:
        out[col] = pd.to_numeric(df.get(col, 0.0), errors="coerce")

    # --- Optional numeric features (NaN -> 0.0 filled by caller) ---
    for col in _OPTIONAL_NUMERIC:
        if col in df.columns:
            out[col] = pd.to_numeric(df[col], errors="coerce")
        else:
            out[col] = np.nan  # caller fills

    # --- Climate zone (ordinal encoding) ---
    if "climate_zone" in df.columns:
        out["climate_zone_code"] = _encode_climate_zone(df["climate_zone"])
    else:
        out["climate_zone_code"] = 0.0

    # --- Interaction features ---
    growth = out["growth_rate_class"]
    drought = out["drought_score"]
    fire = out["fire_score"]
    disease = out["disease_score"]
    planted = out["planted_count"]

    out["stress_composite"] = (drought + fire + disease) / 3.0
    out["growth_x_stress"] = growth * out["stress_composite"]
    out["log_planted_count"] = np.log1p(planted.clip(lower=1))
    out["drought_x_fire"] = drought * fire
    out["growth_sq"] = growth ** 2

    return out
