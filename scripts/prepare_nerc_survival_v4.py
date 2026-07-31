"""
Prepare the NERC EIDC "Survival and heights of trees planted for forest
restoration in South and Southeast Asia" dataset into a TEME v4-compatible
source file.

Citation (required by Open Government Licence v3 -- include in report):
  Banin, L.F.; Raine, E.H.; Rowland, L.M.; Chazdon, R.L.; Smith, S.W.; et al.
  (2023). Survival and heights of trees planted for forest restoration in
  South and Southeast Asia. NERC EDS Environmental Information Data Centre.
  https://doi.org/10.5285/935781e1-9119-4673-bd09-3fc76ae627d5
  Attribution: "Contains data supplied by UK Centre for Ecology & Hydrology."

Inputs:
  - df_survival_nov2022.csv   (5,294 rows, repeated-measures census data)
  - df_study_details.csv     (214 rows, UIC -> Forest type lookup)
  - df_height_nov2022.csv    (6,606 rows, repeated-measures height data)

Output:
  - data/raw/teme_v4/nerc_survival_prepared_v4.csv

METHODOLOGY NOTE (read before trusting any downstream metric):
This source is a repeated-measures dataset: the same planting cohort
(UIC + species_full + plot_id + treatment) is censused at multiple ages,
including a trivial baseline census at duration_months == 0 (always
100% survival by definition). This script collapses each cohort down to
ONE row -- the longest-follow-up census available -- so the same planting
event is never counted as multiple independent training rows, and the
trivial 100%-survival baselines are never used as outcomes.

DISCLOSURE OF DERIVATION CONFIDENCE (keep this in the v4 data lineage doc):
  MEASURED             : survival_ratio, planted_count (redefined as
                         monitored cohort size), species_name, region,
                         state_code, wood_density_gcm3, tree_age_years
  DERIVED_DEFENSIBLE   : climate_zone (from Forest type), growth_rate_class
                         (from measured height gain), fire_score (from
                         recorded disturbance type + protection flag)
  IMPUTED_DISCLOSED    : drought_score (coarse forest-type proxy, not a
                         real measurement), disease_score (no basis in
                         source at all -- neutral default for every row)
"""

from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]

GROUP_COLS = ["UIC", "species_full", "plot_id", "treatment"]

# Disturbance code meanings (confirmed against source documentation):
#   F = fire, LG = logged, PL = plantation, AG = agriculture,
#   M = mining, DR = drained
FIRE_DISTURBANCE_CODE = "F"


def _read_csv_robust(path: Path) -> pd.DataFrame:
    """Survival file is UTF-8; study/height files contain latin1 bytes."""
    try:
        return pd.read_csv(path, low_memory=False)
    except UnicodeDecodeError:
        return pd.read_csv(path, encoding="latin1", low_memory=False)


def select_longest_followup_per_cohort(surv: pd.DataFrame) -> pd.DataFrame:
    """
    Collapse repeated-measures census rows to one outcome row per planting
    cohort: the row with the maximum duration_months, excluding the trivial
    duration_months == 0 baseline census entirely.
    """
    nonzero = surv[surv["duration_months"] > 0].copy()
    idx = nonzero.groupby(GROUP_COLS, dropna=False)["duration_months"].idxmax()
    return nonzero.loc[idx].reset_index(drop=True)


def compute_growth_rate_lookup(height: pd.DataFrame) -> pd.DataFrame:
    """
    Derive a real, measured annual growth rate (cm/year) per planting cohort
    from the height file: (last height - first height) / (last duration -
    first duration), using the earliest and latest available census per
    cohort. Cohorts with only one usable census, or non-positive elapsed
    time, cannot yield a rate and are dropped from the lookup
    (growth_rate_class falls back to an imputed default for those rows,
    exactly as disclosed above).
    """
    h = height.copy()
    h["height_final"] = h["height_cm_v2"]

    key_cols = ["UIC", "species_full", "plot_id"]
    rows = []
    for keys, group in h.groupby(key_cols, dropna=False):
        group = group.dropna(subset=["height_final", "duration_months"])
        if len(group) < 2:
            continue
        first = group.loc[group["duration_months"].idxmin()]
        last = group.loc[group["duration_months"].idxmax()]
        elapsed_months = last["duration_months"] - first["duration_months"]
        if elapsed_months <= 0:
            continue
        height_gain_cm = last["height_final"] - first["height_final"]
        agr_cm_per_year = (height_gain_cm / elapsed_months) * 12.0
        rows.append({**dict(zip(key_cols, keys)), "agr_cm_per_year": agr_cm_per_year})

    lookup = pd.DataFrame(rows)
    if lookup.empty:
        return lookup

    clipped = lookup["agr_cm_per_year"].clip(lower=0, upper=lookup["agr_cm_per_year"].quantile(0.99))
    lookup["growth_rate_class"] = (
        pd.qcut(clipped, q=10, labels=False, duplicates="drop") + 1
    )
    return lookup


def climate_zone_and_drought_from_forest_type(forest_type: str | float) -> tuple[str, float]:
    """
    DERIVED_DEFENSIBLE (climate_zone) / IMPUTED_DISCLOSED (drought_score).
    Peat swamp forest (TPSF) is permanently waterlogged -> low drought
    exposure. Mineral-soil tropical forest (TF) gets a moderate neutral
    default. This is a coarse proxy, not a measurement.
    """
    if forest_type == "TPSF":
        return "Tropical_Peat_Swamp_Forest", 2.0
    if forest_type == "TF":
        return "Tropical_Forest_Mineral_Soil", 5.0
    return "Unknown_TropicalAsia", 5.0


def fire_score_from_disturbance(disturbance: str, protection: float) -> float:
    """
    DERIVED_DEFENSIBLE: grounded in the real recorded disturbance history
    and real recorded protection measures (fire breaks / fencing), not
    fabricated. Fire-disturbed sites get an elevated score; documented
    protection measures pull it back down; floor at 1.
    """
    base = 8.0 if disturbance == FIRE_DISTURBANCE_CODE else 3.0
    if protection == 1:
        base -= 2.0
    return max(1.0, base)


def build_nerc_survival_v4(
    survival_path: Path,
    study_details_path: Path,
    height_path: Path,
    output_path: Path,
) -> tuple[pd.DataFrame, dict]:
    surv_raw = _read_csv_robust(survival_path)
    study = _read_csv_robust(study_details_path)
    height_raw = _read_csv_robust(height_path)

    surv = select_longest_followup_per_cohort(surv_raw)

    study_lookup = study[["UIC", "Forest type"]].drop_duplicates(subset=["UIC"])
    surv = surv.merge(study_lookup, on="UIC", how="left")

    growth_lookup = compute_growth_rate_lookup(height_raw)
    if not growth_lookup.empty:
        surv = surv.merge(
            growth_lookup[["UIC", "species_full", "plot_id", "growth_rate_class"]],
            on=["UIC", "species_full", "plot_id"],
            how="left",
        )
    else:
        surv["growth_rate_class"] = np.nan

    growth_rate_matched = surv["growth_rate_class"].notna().sum()
    surv["growth_rate_class"] = surv["growth_rate_class"].fillna(5.0)

    # IMPORTANT: initialise with surv's index so that scalar assignments
    # (source, row_origin, dataset_version) broadcast to all rows correctly.
    # pd.DataFrame() has no index; scalars assigned before the first Series
    # column would silently become NaN after the index is established.
    out = pd.DataFrame(index=surv.index)

    out["source"] = "NERC_EIDC_2023_survival_height"
    out["row_origin"] = "real"
    out["dataset_version"] = "teme_survival_v4_nerc"
    out["observation_date"] = pd.NA

    out["species_name"] = surv["species_full"]
    out["species_id"] = surv["species_full"].str.lower().str.replace(" ", "_", regex=False)

    out["region"] = surv["province"].fillna(surv["country"])
    out["state_code"] = surv["province"].fillna(surv["country"])

    out["planted_count"] = surv["number_alive"] + surv["number_dead"]
    out["actual_alive_count"] = surv["number_alive"]
    out["actual_dead_count"] = surv["number_dead"]
    out["survival_ratio"] = (surv["number_alive"] / out["planted_count"]).clip(0.0, 1.0)
    out["ground_truth_observed_survival"] = out["survival_ratio"]
    out["years_tracked"] = (surv["duration_months"] / 12.0).round(2)

    out["wood_density_gcm3"] = surv["w_meanWD"]
    out["tree_age_years"] = surv["age_0"]

    zone_drought = surv["Forest type"].apply(climate_zone_and_drought_from_forest_type)
    out["climate_zone"] = [z for z, _ in zone_drought]
    out["drought_score"] = [d for _, d in zone_drought]

    out["fire_score"] = [
        fire_score_from_disturbance(dist, prot)
        for dist, prot in zip(surv["disturbance"], surv["protection"])
    ]

    out["disease_score"] = 5.0

    out["growth_rate_class"] = surv["growth_rate_class"]

    out["region_drought_risk"] = np.nan
    out["region_fire_risk"] = np.nan
    out["region_disease_risk"] = np.nan
    out["species_drought_tolerance"] = np.nan
    out["species_growth_form"] = np.nan
    out["soil_ph"] = np.nan
    out["soil_organic_carbon_pct"] = np.nan
    out["soil_clay_pct"] = np.nan
    out["annual_rainfall_mm"] = np.nan
    out["tmax_mean_c"] = np.nan
    out["vpd_mean_hpa"] = np.nan
    out["planting_month"] = np.nan
    out["ndvi_at_planting"] = np.nan
    out["surrounding_landuse"] = np.nan
    out["elevation_m"] = np.nan

    management_cols = ["comp_removal", "shading", "soil_prep", "water_reg", "fertilisation", "protection"]
    out["management_score"] = (
        surv[management_cols].apply(pd.to_numeric, errors="coerce").fillna(0).sum(axis=1) / len(management_cols) * 5.0
    )

    output_path.parent.mkdir(parents=True, exist_ok=True)
    out.to_csv(output_path, index=False)

    metadata = {
        "input_rows_survival_raw": len(surv_raw),
        "input_rows_after_dedup": len(surv),
        "input_rows_height_raw": len(height_raw),
        "cohorts_with_measured_growth_rate": int(growth_rate_matched),
        "cohorts_with_imputed_growth_rate_default": int(len(surv) - growth_rate_matched),
        "india_rows": int((surv["country"] == "India").sum()),
        "unique_species": int(surv["species_full"].nunique()),
        "unique_countries": int(surv["country"].nunique()),
    }
    return out, metadata


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Prepare NERC survival/height source for TEME v4")
    parser.add_argument("--survival", default=str(ROOT / "df_survival_nov2022.csv"))
    parser.add_argument("--study-details", default=str(ROOT / "df_study_details.csv"))
    parser.add_argument("--height", default=str(ROOT / "df_height_nov2022.csv"))
    parser.add_argument("--out", default=str(ROOT / "data" / "raw" / "teme_v4" / "nerc_survival_prepared_v4.csv"))
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    out_df, meta = build_nerc_survival_v4(
        Path(args.survival), Path(args.study_details), Path(args.height), Path(args.out)
    )
    print("[TEME V4 NERC SOURCE] Preparation complete")
    print(f"[TEME V4 NERC SOURCE] Output file: {args.out}")
    print(f"[TEME V4 NERC SOURCE] Rows (deduplicated outcomes): {len(out_df)}")
    print(f"[TEME V4 NERC SOURCE] India rows: {meta['india_rows']}")
    print(f"[TEME V4 NERC SOURCE] Unique species: {meta['unique_species']}")
    print(f"[TEME V4 NERC SOURCE] Unique countries: {meta['unique_countries']}")
    print(
        f"[TEME V4 NERC SOURCE] Growth rate: {meta['cohorts_with_measured_growth_rate']} measured, "
        f"{meta['cohorts_with_imputed_growth_rate_default']} imputed default"
    )


if __name__ == "__main__":
    main()