"""
Prepare real_anchor_raw.csv into a TEME v4-compatible source file.

Source: Indian government forest plantation monitoring reports
        (Green India Mission / compensatory afforestation scheme)

Only rows with Total Plant No > 0 are usable -- the remaining rows are
pre-planting expenditure records (Advance Works stage) with no survival
outcome and are excluded.

DISCLOSURE OF DERIVATION CONFIDENCE:
  MEASURED             : survival_ratio, planted_count, state_code
  DERIVED_DEFENSIBLE   : drought_score, fire_score (from published
                         Köppen climate classification for Indian states
                         -- well-established public geographic knowledge,
                         same tier as NERC fire_score from disturbance type)
  IMPUTED_DISCLOSED    : growth_rate_class (rough proxy from Plant height
                         field; integer-rounded, low precision),
                         disease_score (no pathogen records in source --
                         neutral default for all rows)

NOTE on validation:
  This source has no species information. drought_score and fire_score
  vary by state (corrected from the earlier flat-5 default that made all
  states send identical input vectors to the model). growth_rate_class and
  disease_score remain honestly neutral defaults -- there is no basis for
  differentiating them from this source.
"""

from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]

# DERIVED_DEFENSIBLE: Köppen climate classification for Indian states is
# well-established public geographic knowledge, not a per-record measurement.
# Only drought_score and fire_score are legitimately derivable from known
# state-level climate; growth_rate_class and disease_score remain honestly
# imputed defaults.
STATE_CLIMATE_SCORES: dict[str, dict[str, float]] = {
    "sikkim":        {"drought_score": 2.0, "fire_score": 2.0},  # Cwb -- humid subtropical highland
    "punjab":        {"drought_score": 6.0, "fire_score": 4.0},  # BSh -- semi-arid
    "rajasthan":     {"drought_score": 8.0, "fire_score": 6.0},  # BWh/BSh -- arid/semi-arid
    "uttar pradesh": {"drought_score": 5.0, "fire_score": 3.0},  # Cwa/Aw -- subtropical, mixed
    "maharashtra":   {"drought_score": 5.0, "fire_score": 4.0},  # Aw/BSh -- tropical savanna/semi-arid
    "madhya pradesh":{"drought_score": 5.0, "fire_score": 4.0},  # Aw/BSh
    "telangana":     {"drought_score": 5.0, "fire_score": 4.0},  # Aw -- tropical savanna
    "gujarat":       {"drought_score": 7.0, "fire_score": 5.0},  # BSh/BWh -- semi-arid to arid
    "himachal pradesh":{"drought_score": 3.0, "fire_score": 3.0},# Cwb/ET -- highland, humid
    "odisha":        {"drought_score": 4.0, "fire_score": 3.0},  # Aw -- tropical, moderate
    "meghalaya":     {"drought_score": 2.0, "fire_score": 2.0},  # Cwa -- high rainfall
    "uttarakhand":   {"drought_score": 3.0, "fire_score": 3.0},  # Cwb/highland -- humid
}
DEFAULT_CLIMATE_SCORES: dict[str, float] = {"drought_score": 5.0, "fire_score": 5.0}


def climate_scores_for_state(state: str | float) -> dict[str, float]:
    key = str(state).strip().lower() if pd.notna(state) else ""
    return STATE_CLIMATE_SCORES.get(key, DEFAULT_CLIMATE_SCORES)


def growth_rate_class_from_height(height: float | None) -> float:
    """
    IMPUTED_DISCLOSED: Plant height values in this source are integer-rounded
    estimates in cm. Mapping cm -> growth_rate_class 1-10 is a coarse proxy,
    not a real measurement of annual increment.
    """
    if pd.isna(height) or height <= 0:
        return 5.0  # neutral default
    return float(max(1, min(10, int(round(height)))))


def prepare_real_anchor_v4(input_path: Path, output_path: Path) -> tuple[pd.DataFrame, dict]:
    raw = pd.read_csv(input_path, low_memory=False)

    n_raw = len(raw)
    usable = raw[raw["Total Plant No"] > 0].copy().reset_index(drop=True)
    n_usable = len(usable)

    out = pd.DataFrame(index=usable.index)

    out["source"] = "real_anchor_raw_India"
    out["row_origin"] = "real"
    out["dataset_version"] = "teme_survival_v4"
    out["observation_date"] = pd.NA

    out["species_name"] = "unknown"   # no species data in source
    out["species_id"] = "unknown"

    out["region"] = usable["State"].fillna("unknown")
    out["state_code"] = usable["State"].fillna("unknown")

    out["planted_count"] = pd.to_numeric(usable["Total Plant No"], errors="coerce").clip(lower=1)
    out["actual_alive_count"] = pd.to_numeric(usable["Plant Survived"], errors="coerce")
    out["actual_dead_count"] = out["planted_count"] - out["actual_alive_count"]
    out["survival_ratio"] = (out["actual_alive_count"] / out["planted_count"]).clip(0.0, 1.0)
    out["ground_truth_observed_survival"] = out["survival_ratio"]
    out["years_tracked"] = np.nan   # no follow-up duration in source

    # DERIVED_DEFENSIBLE: state-level Köppen climate scores
    climate = usable["State"].apply(climate_scores_for_state)
    out["drought_score"] = [c["drought_score"] for c in climate]
    out["fire_score"] = [c["fire_score"] for c in climate]

    # IMPUTED_DISCLOSED: no pathogen records, no height growth rate
    out["growth_rate_class"] = usable["Plant height"].apply(growth_rate_class_from_height)
    out["disease_score"] = 5.0

    out["climate_zone"] = "Unknown_India"
    out["wood_density_gcm3"] = np.nan
    out["tree_age_years"] = np.nan
    out["management_score"] = np.nan

    for col in [
        "region_drought_risk", "region_fire_risk", "region_disease_risk",
        "species_drought_tolerance", "species_growth_form",
        "soil_ph", "soil_organic_carbon_pct", "soil_clay_pct",
        "annual_rainfall_mm", "tmax_mean_c", "vpd_mean_hpa",
        "planting_month", "ndvi_at_planting", "surrounding_landuse", "elevation_m",
    ]:
        out[col] = np.nan

    output_path.parent.mkdir(parents=True, exist_ok=True)
    out.to_csv(output_path, index=False)

    state_counts = usable["State"].value_counts().to_dict()
    metadata = {
        "input_rows_raw": n_raw,
        "rows_excluded_zero_plants": n_raw - n_usable,
        "rows_usable": n_usable,
        "states_represented": list(state_counts.keys()),
        "state_row_counts": state_counts,
        "drought_score_neutral_default_used": int(
            usable["State"].str.strip().str.lower().apply(
                lambda s: s not in STATE_CLIMATE_SCORES
            ).sum()
        ),
    }
    return out, metadata


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Prepare real_anchor_raw.csv for TEME v4")
    p.add_argument("--in", dest="input_path", default=str(ROOT / "real_anchor_raw.csv"))
    p.add_argument("--out", dest="output_path",
                   default=str(ROOT / "data" / "raw" / "teme_v4" / "real_anchor_prepared_v4.csv"))
    return p.parse_args()


def main() -> None:
    args = parse_args()
    out_df, meta = prepare_real_anchor_v4(Path(args.input_path), Path(args.output_path))
    print("[REAL ANCHOR V4] Preparation complete")
    print(f"[REAL ANCHOR V4] Output: {args.output_path}")
    print(f"[REAL ANCHOR V4] Raw rows: {meta['input_rows_raw']}")
    print(f"[REAL ANCHOR V4] Excluded (zero plants): {meta['rows_excluded_zero_plants']}")
    print(f"[REAL ANCHOR V4] Usable rows: {meta['rows_usable']}")
    print(f"[REAL ANCHOR V4] States: {meta['states_represented']}")
    print(f"[REAL ANCHOR V4] Rows using neutral default scores: {meta['drought_score_neutral_default_used']}")
    print()
    print("[REAL ANCHOR V4] DISCLOSURE: drought_score and fire_score are DERIVED_DEFENSIBLE")
    print("                 from published Köppen classification, not field measurements.")
    print("                 growth_rate_class and disease_score are IMPUTED_DISCLOSED defaults.")


if __name__ == "__main__":
    main()
