"""
Final trainer for TEME v4 survival modeling.

Builds on the scaffold: same GroupKFold + species target encoding + sample
weighting. Adds three things the scaffold left as placeholders:

  1. Isotonic calibration, fit on out-of-fold predictions (leakage-safe --
     OOF predictions come from models that never saw those rows during
     training, so no separate calibration split is needed).
  2. Uncertainty bands from tree-level prediction spread (every tree in the
     ExtraTrees ensemble is queried individually; p10/p50/p90 computed from
     that spread -- zero extra training cost, no separate quantile models).
  3. SHAP TreeExplainer for per-prediction explainability.

Also reports REAL-ONLY metrics separately from MIXED (real+synthetic)
metrics -- do not trust the mixed number alone; it is dominated by however
much synthetic data remains in the training set.

Usage:
  python scripts/train_teme_survival_v4.py
  python scripts/train_teme_survival_v4.py --config packages/ml_services/teme/ml/config_v4.json
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import sys
import warnings
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import ExtraTreesRegressor
from sklearn.isotonic import IsotonicRegression
from sklearn.metrics import mean_absolute_error, r2_score
from sklearn.model_selection import GroupKFold, KFold

ROOT = Path(__file__).resolve().parents[1]
PACKAGES_DIR = ROOT / "packages"
if str(PACKAGES_DIR) not in sys.path:
    sys.path.insert(0, str(PACKAGES_DIR))

from ml_services.teme.ml.features_v4 import SpeciesTargetEncoder, build_features_v4

try:
    import shap
    SHAP_AVAILABLE = True
except ImportError:
    SHAP_AVAILABLE = False


@dataclass
class TrainConfig:
    dataset_path: Path
    model_output_path: Path
    run_base_dir: Path
    report_name: str
    target_column: str
    n_splits: int
    random_seed: int
    target_encoder_alpha: float
    real_weight: float
    synthetic_weight: float
    point_model_params: dict[str, Any]
    model_version: str


def _merge_dict(base: dict[str, Any], override: dict[str, Any]) -> dict[str, Any]:
    out = dict(base)
    for key, value in override.items():
        if isinstance(value, dict) and isinstance(out.get(key), dict):
            out[key] = _merge_dict(out[key], value)
        else:
            out[key] = value
    return out


def load_config(config_path: Path) -> TrainConfig:
    defaults: dict[str, Any] = {
        "dataset_path": str(ROOT / "data" / "datasets" / "v_survival_training_v4.csv"),
        "model_output_path": str(
            ROOT / "packages" / "ml_services" / "teme" / "ml" / "models" / "teme_survival_v4.joblib"
        ),
        "run_base_dir": str(ROOT / "TEME_ML_checkpoints"),
        "report_name": "training_report.json",
        "target_column": "survival_ratio",
        "n_splits": 5,
        "random_seed": 42,
        "target_encoder_alpha": 20.0,
        "sample_weights": {"real": 3.0, "synthetic": 1.0},
        "point_model": {
            "n_estimators": 500,
            "max_depth": 16,
            "min_samples_leaf": 3,
            "random_state": 42,
            "n_jobs": -1,
        },
        "model_version": "teme-survival-v4.0",
    }
    if config_path.exists():
        payload = json.loads(config_path.read_text(encoding="utf-8"))
        cfg = _merge_dict(defaults, payload)
    else:
        cfg = defaults

    return TrainConfig(
        dataset_path=Path(cfg["dataset_path"]),
        model_output_path=Path(cfg["model_output_path"]),
        run_base_dir=Path(cfg["run_base_dir"]),
        report_name=str(cfg["report_name"]),
        target_column=str(cfg["target_column"]),
        n_splits=int(cfg["n_splits"]),
        random_seed=int(cfg["random_seed"]),
        target_encoder_alpha=float(cfg["target_encoder_alpha"]),
        real_weight=float(cfg["sample_weights"]["real"]),
        synthetic_weight=float(cfg["sample_weights"]["synthetic"]),
        point_model_params=dict(cfg["point_model"]),
        model_version=str(cfg["model_version"]),
    )


def _coerce_numeric(df: pd.DataFrame, target_col: str) -> pd.DataFrame:
    out = df.copy()
    numeric_cols = [
        "growth_rate_class", "drought_score", "fire_score", "disease_score", "planted_count",
        "species_drought_tolerance", "soil_ph", "soil_organic_carbon_pct", "soil_clay_pct",
        "annual_rainfall_mm", "tmax_mean_c", "vpd_mean_hpa", "tree_age_years", "planting_month",
        "management_score", "ndvi_at_planting", target_col,
    ]
    for col in numeric_cols:
        if col in out.columns:
            out[col] = pd.to_numeric(out[col], errors="coerce")
    return out


def prepare_training_frame(df: pd.DataFrame, target_col: str) -> pd.DataFrame:
    required = ["growth_rate_class", "drought_score", "fire_score", "disease_score", "planted_count", target_col]
    missing = [c for c in required if c not in df.columns]
    if missing:
        raise ValueError(f"Missing required training columns: {missing}")

    out = df.copy()
    if "species_name" not in out.columns:
        out["species_name"] = "unknown"

    out = _coerce_numeric(out, target_col=target_col)
    out = out.dropna(subset=required).copy()

    out[target_col] = out[target_col].clip(0.0, 1.0)
    out["growth_rate_class"] = out["growth_rate_class"].clip(1, 10)
    out["drought_score"] = out["drought_score"].clip(1, 10)
    out["fire_score"] = out["fire_score"].clip(1, 10)
    out["disease_score"] = out["disease_score"].clip(1, 10)
    out["planted_count"] = out["planted_count"].clip(lower=1)
    out["species_name"] = out["species_name"].astype(str).replace({"": "unknown", "nan": "unknown"})

    if "row_origin" not in out.columns:
        if "is_synthetic" in out.columns:
            out["row_origin"] = np.where(
                pd.to_numeric(out["is_synthetic"], errors="coerce").fillna(1) <= 0, "real", "synthetic"
            )
        else:
            out["row_origin"] = "synthetic"

    return out.reset_index(drop=True)


def build_groups(df: pd.DataFrame) -> pd.Series:
    species = (
        df.get("species_name", pd.Series(["unknown"] * len(df), index=df.index))
        .fillna("unknown").astype(str)
    )
    if "state_code" in df.columns:
        state_or_region = df["state_code"].fillna("unknown").astype(str)
    elif "region" in df.columns:
        state_or_region = df["region"].fillna("unknown").astype(str)
    else:
        state_or_region = pd.Series(["unknown"] * len(df), index=df.index)
    grouped = species.str.lower().str.strip() + "|" + state_or_region.str.lower().str.strip()
    return grouped.fillna("unknown|unknown")


def build_sample_weights(df: pd.DataFrame, real_weight: float, synthetic_weight: float) -> np.ndarray:
    if "row_origin" in df.columns:
        origin = df["row_origin"].astype(str).str.lower().str.strip()
        is_real = origin.eq("real")
        return np.where(is_real, real_weight, synthetic_weight).astype(float)
    if "is_synthetic" in df.columns:
        syn = pd.to_numeric(df["is_synthetic"], errors="coerce").fillna(1.0)
        return np.where(syn <= 0.0, real_weight, synthetic_weight).astype(float)
    return np.full(len(df), synthetic_weight, dtype=float)


def _build_model(params: dict[str, Any]) -> ExtraTreesRegressor:
    return ExtraTreesRegressor(**params)


def _finalize_numeric_matrix(frame: pd.DataFrame) -> pd.DataFrame:
    numeric = pd.DataFrame(index=frame.index)
    for col in frame.columns:
        numeric[col] = pd.to_numeric(frame[col], errors="coerce")
    numeric = numeric.replace([np.inf, -np.inf], np.nan).fillna(0.0)
    return numeric


def _prepare_fold_matrices(
    train_df: pd.DataFrame,
    val_df: pd.DataFrame,
    target_col: str,
    alpha: float,
) -> tuple[pd.DataFrame, pd.DataFrame, SpeciesTargetEncoder]:
    encoder = SpeciesTargetEncoder(alpha=alpha)
    encoder.fit(train_df["species_name"], train_df[target_col])

    x_train = build_features_v4(train_df)
    x_val = build_features_v4(val_df)
    x_train["species_target_enc"] = encoder.transform(train_df["species_name"])
    x_val["species_target_enc"] = encoder.transform(val_df["species_name"])

    return _finalize_numeric_matrix(x_train), _finalize_numeric_matrix(x_val), encoder


def compute_metrics(y_true: np.ndarray, y_pred: np.ndarray) -> dict[str, Any]:
    if len(y_true) == 0:
        return {"mae": None, "r2": None, "n": 0}
    mae = float(mean_absolute_error(y_true, y_pred))
    r2 = float(r2_score(y_true, y_pred)) if len(set(y_true)) > 1 else None
    return {"mae": mae, "r2": r2, "n": int(len(y_true))}


def run_grouped_cv(df: pd.DataFrame, cfg: TrainConfig) -> dict[str, Any]:
    target_col = cfg.target_column
    groups = build_groups(df)
    n_unique_groups = int(groups.nunique())
    n_splits = max(2, min(cfg.n_splits, n_unique_groups))

    if n_unique_groups >= n_splits:
        splitter = GroupKFold(n_splits=n_splits)
        split_iter = splitter.split(df, groups=groups)
        split_name = "GroupKFold"
    else:
        splitter = KFold(n_splits=n_splits, shuffle=True, random_state=cfg.random_seed)
        split_iter = splitter.split(df)
        split_name = "KFold_fallback"

    y_all = df[target_col].to_numpy(dtype=float)
    weights = build_sample_weights(df, cfg.real_weight, cfg.synthetic_weight)
    oof = np.full(len(df), np.nan, dtype=float)
    fold_metrics: list[dict[str, Any]] = []

    for fold_id, (train_idx, val_idx) in enumerate(split_iter, start=1):
        train_df = df.iloc[train_idx].copy()
        val_df = df.iloc[val_idx].copy()

        x_train, x_val, _ = _prepare_fold_matrices(
            train_df, val_df, target_col, cfg.target_encoder_alpha
        )
        y_train = train_df[target_col].to_numpy(dtype=float)
        y_val = val_df[target_col].to_numpy(dtype=float)
        w_train = weights[train_idx]

        model = _build_model(cfg.point_model_params)
        model.fit(x_train, y_train, sample_weight=w_train)

        preds = np.clip(model.predict(x_val), 0.0, 1.0)
        oof[val_idx] = preds

        m = compute_metrics(y_val, preds)
        fold_metrics.append({
            "fold": fold_id,
            "rows_train": int(len(train_idx)),
            "rows_val": int(len(val_idx)),
            **m,
        })
        print(f"[TEME V4 TRAIN] Fold {fold_id}/{n_splits} | MAE={m['mae']:.5f} | R2={m['r2']}")

    valid = ~np.isnan(oof)
    overall = compute_metrics(y_all[valid], oof[valid])

    # --- Real-only vs mixed breakdown (do not trust mixed alone) ---
    origin = df["row_origin"].astype(str).str.lower().str.strip().to_numpy()
    real_mask = valid & (origin == "real")
    real_only = compute_metrics(y_all[real_mask], oof[real_mask])

    return {
        "splitter": split_name,
        "n_splits": n_splits,
        "n_unique_groups": n_unique_groups,
        "fold_metrics": fold_metrics,
        "oof_predictions": oof,
        "oof_mixed": overall,
        "oof_real_only": real_only,
    }


def fit_calibrator(
    y_true_real: np.ndarray, y_pred_real: np.ndarray
) -> IsotonicRegression | None:
    """
    Fit isotonic calibration on REAL-ONLY out-of-fold predictions. Using
    real-only rows for calibration (not the synthetic-heavy full set) means
    the calibration curve reflects real-world behavior, not the synthetic
    generator's formula.
    """
    if len(y_true_real) < 10:
        print(
            f"[TEME V4 TRAIN] Only {len(y_true_real)} real OOF rows -- "
            "skipping calibration (need >= 10)."
        )
        return None
    calibrator = IsotonicRegression(out_of_bounds="clip", y_min=0.0, y_max=1.0)
    calibrator.fit(y_pred_real, y_true_real)
    return calibrator


def build_shap_explainer(model: ExtraTreesRegressor, sample_X: pd.DataFrame):
    if not SHAP_AVAILABLE:
        print(
            "[TEME V4 TRAIN] shap not installed -- skipping explainer "
            "(pip install shap to enable)."
        )
        return None
    try:
        explainer = shap.TreeExplainer(model)
        return explainer
    except Exception as e:
        print(f"[TEME V4 TRAIN] SHAP explainer construction failed: {e} -- continuing without it.")
        return None


def train_final_model(df: pd.DataFrame, cfg: TrainConfig):
    target_col = cfg.target_column
    encoder = SpeciesTargetEncoder(alpha=cfg.target_encoder_alpha)
    encoder.fit(df["species_name"], df[target_col])

    x_all = build_features_v4(df)
    x_all["species_target_enc"] = encoder.transform(df["species_name"])
    x_all = _finalize_numeric_matrix(x_all)

    feature_cols = x_all.columns.tolist()
    y_all = df[target_col].to_numpy(dtype=float)
    w_all = build_sample_weights(df, cfg.real_weight, cfg.synthetic_weight)

    model = _build_model(cfg.point_model_params)
    model.fit(x_all, y_all, sample_weight=w_all)

    return model, encoder.export_state(), feature_cols, x_all


def write_report(path: Path, report: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(report, indent=2, default=str), encoding="utf-8")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Train TEME v4 survival model (final)")
    parser.add_argument(
        "--config",
        default=str(ROOT / "packages" / "ml_services" / "teme" / "ml" / "config_v4.json"),
    )
    parser.add_argument("--data", default=None)
    parser.add_argument("--out", default=None)
    parser.add_argument("--report-only", action="store_true")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    cfg = load_config(Path(args.config))
    if args.data:
        cfg.dataset_path = Path(args.data)
    if args.out:
        cfg.model_output_path = Path(args.out)

    if not cfg.dataset_path.exists():
        raise FileNotFoundError(f"Dataset not found: {cfg.dataset_path}")

    timestamp = dt.datetime.now(dt.timezone.utc).strftime("%Y%m%d_%H%M%S")
    run_dir = cfg.run_base_dir / f"teme_survival_v4_run_{timestamp}"
    run_dir.mkdir(parents=True, exist_ok=True)

    print("[TEME V4 TRAIN] Loading dataset")
    df_raw = pd.read_csv(cfg.dataset_path)
    df = prepare_training_frame(df_raw, target_col=cfg.target_column)

    if len(df) < 100:
        raise ValueError(f"Not enough valid rows to train v4 (rows={len(df)}).")

    n_real = int((df["row_origin"] == "real").sum())
    print(
        f"[TEME V4 TRAIN] Rows after validation: {len(df)} "
        f"(real={n_real}, synthetic={len(df) - n_real})"
    )

    print("[TEME V4 TRAIN] Running grouped CV")
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        cv_report = run_grouped_cv(df, cfg)

    print()
    print("[TEME V4 TRAIN] === MIXED (real+synthetic) OOF metrics ===")
    print(
        f"  MAE={cv_report['oof_mixed']['mae']:.5f}  "
        f"R2={cv_report['oof_mixed']['r2']}  "
        f"n={cv_report['oof_mixed']['n']}"
    )
    print("[TEME V4 TRAIN] === REAL-ONLY OOF metrics (trust this one) ===")
    print(
        f"  MAE={cv_report['oof_real_only']['mae']}  "
        f"R2={cv_report['oof_real_only']['r2']}  "
        f"n={cv_report['oof_real_only']['n']}"
    )
    print()

    report: dict[str, Any] = {
        "run_id": run_dir.name,
        "created_at_utc": dt.datetime.now(dt.timezone.utc).isoformat(),
        "dataset_path": str(cfg.dataset_path),
        "model_output_path": str(cfg.model_output_path),
        "target_column": cfg.target_column,
        "model_version": cfg.model_version,
        "rows_total": int(len(df_raw)),
        "rows_used": int(len(df)),
        "rows_real": n_real,
        "rows_synthetic": int(len(df) - n_real),
        "cv": {k: v for k, v in cv_report.items() if k != "oof_predictions"},
    }

    report_path = run_dir / cfg.report_name

    if args.report_only:
        write_report(report_path, report)
        print(f"[TEME V4 TRAIN] Report-only run complete: {report_path}")
        return

    # --- Fit calibrator on REAL-ONLY OOF predictions ---
    origin = df["row_origin"].astype(str).str.lower().str.strip().to_numpy()
    oof = cv_report["oof_predictions"]
    real_mask = ~np.isnan(oof) & (origin == "real")
    y_all = df[cfg.target_column].to_numpy(dtype=float)

    print("[TEME V4 TRAIN] Fitting calibrator")
    calibrator = fit_calibrator(y_all[real_mask], oof[real_mask])

    print("[TEME V4 TRAIN] Fitting final model on full dataset")
    point_model, encoder_state, feature_cols, x_all_for_shap = train_final_model(df, cfg)

    print("[TEME V4 TRAIN] Building SHAP explainer")
    shap_explainer = build_shap_explainer(point_model, x_all_for_shap)

    artifact_bundle = {
        "artifact_version": "teme_survival_v4_final_v1",
        "created_at_utc": dt.datetime.now(dt.timezone.utc).isoformat(),
        "model_point": point_model,
        "calibrator": calibrator,
        "shap_explainer": shap_explainer,
        "species_map": encoder_state["species_map"],
        "global_mean": encoder_state["global_mean"],
        "feature_cols": feature_cols,
        "metadata": {
            "version": cfg.model_version,
            "cv_oof_mixed": cv_report["oof_mixed"],
            "cv_oof_real_only": cv_report["oof_real_only"],
            "n_rows_used": int(len(df)),
            "n_rows_real": n_real,
            "n_features": int(len(feature_cols)),
            "calibrated": calibrator is not None,
            "shap_available": shap_explainer is not None,
            "notes": [
                "Uncertainty computed at inference time from per-tree prediction "
                "spread (see survival_v4.py) -- no separate quantile models trained.",
                "Calibration fit on REAL-ONLY out-of-fold predictions, not the "
                "synthetic-heavy full set.",
                "cv_oof_mixed includes synthetic data and should not be quoted "
                "alone -- see cv_oof_real_only for the trustworthy number.",
            ],
        },
    }

    cfg.model_output_path.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(artifact_bundle, cfg.model_output_path)

    report["artifact_path"] = str(cfg.model_output_path)
    report["artifact_version"] = artifact_bundle["artifact_version"]
    report["feature_count"] = len(feature_cols)
    report["calibrated"] = calibrator is not None
    report["shap_available"] = shap_explainer is not None
    write_report(report_path, report)

    print()
    print("[TEME V4 TRAIN] Training complete")
    print(f"[TEME V4 TRAIN] Artifact: {cfg.model_output_path}")
    print(f"[TEME V4 TRAIN] Report  : {report_path}")


if __name__ == "__main__":
    main()
