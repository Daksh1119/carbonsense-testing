# TEME Survival Dataset Schema (v2)

This document defines the dataset schema used for TEME survival-model retraining.
It aligns with:
- Species traits: `packages/ml_services/teme/data/species_catalog.py`
- Validation metadata: `packages/ml_services/teme/calibration/validation_data.py`
- Runtime model features: `packages/ml_services/teme/ml/survival.py`

## Current Runtime Model Inputs

The current RF model (`rf_survival_v1_1.pkl`) consumes 5 features:

1. `growth_rate_class` (int, 1-10)
2. `drought_score` (int, 1-10)
3. `fire_score` (int, 1-10)
4. `disease_score` (int, 1-10)
5. `planted_count` (int, > 0)

Target:
- `survival_ratio` (float, 0-1)

## Single Canonical Dataset

File: `data/datasets/v_survival_training.csv`

This single file is both:
- backward-compatible for current model retraining (first 10 legacy fields), and
- extended with schema metadata for future model upgrades.

Legacy training columns:
1. `species_id`
2. `growth_rate_class`
3. `drought_score`
4. `fire_score`
5. `disease_score`
6. `planted_count`
7. `actual_alive_count`
8. `actual_dead_count`
9. `survival_ratio`
10. `observation_date`

Extended metadata columns:

1. `species_name`
2. `region`
3. `region_drought_risk`
4. `region_fire_risk`
5. `region_disease_risk`
6. `years_tracked`
7. `ground_truth_observed_survival`
8. `source`
9. `is_synthetic` (`0` or `1`)
10. `dataset_version`

Purpose:
- Keep one source of truth for retraining and data lineage.
- Preserve calibration context and support region-aware modeling.

## Generation Process

Script:
- `scripts/generate_teme_survival_dataset.py`

Default behavior:
- Reads base data from `data/datasets/v_survival_training.csv`.
- Uses species traits from `SPECIES_CATALOG`.
- Uses species-region validation pairs from `GROUND_TRUTH_SURVIVAL`.
- Generates synthetic rows up to target size (default: 12000 rows).
- Writes one single large extended dataset at `data/datasets/v_survival_training.csv`.

## Data Quality Rules

1. `actual_alive_count + actual_dead_count == planted_count`
2. `survival_ratio == actual_alive_count / planted_count`
3. score fields remain within `1..10`
4. `survival_ratio` remains bounded in `[0.35, 0.98]` for synthetic rows
5. dates are ISO `YYYY-MM-DD`

## Recommended Next Step for Model Upgrade

1. Train RF v1.2 from `v_survival_training.csv` (same 5-feature contract).
2. Evaluate MAE/R2 against current baseline model.
3. If improved, export to:
   - `packages/ml_services/teme/ml/models/rf_survival_v1_2.pkl`
4. Then update runtime loader in `packages/ml_services/teme/ml/survival.py`.
