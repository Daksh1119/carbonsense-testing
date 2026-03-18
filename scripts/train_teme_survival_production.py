"""
Single-script retraining pipeline for TEME Survival ML (v2, production-ready).

Upgrades included:
- Trains by default on the newly generated canonical dataset:
  data/datasets/v_survival_training.csv
- Keeps compatibility with TEME engine runtime input signature:
  [growth_rate_class, drought_score, fire_score, disease_score, planted_count]
- Performs robust cleaning, feature engineering, hyperparameter tuning,
  model selection, and artifact checkpointing.
- Supports Colab Drive + local runs.

Usage (local):
  C:/.../.venv/Scripts/python.exe scripts/train_teme_survival_production.py

Usage (Colab):
  !python scripts/train_teme_survival_production.py
"""

# pyright: reportMissingImports=false, reportMissingModuleSource=false

from __future__ import annotations

import json
import importlib
import os
import random
import time
import warnings
import datetime as dt
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

from sklearn.model_selection import train_test_split, KFold, ParameterSampler
from sklearn.metrics import mean_absolute_error, r2_score, mean_squared_error
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import FunctionTransformer
from sklearn.ensemble import RandomForestRegressor, ExtraTreesRegressor
from sklearn.base import clone
from scipy.stats import randint, uniform
import joblib

try:
    tqdm_module_name = "tqdm" + "." + "auto"
    tqdm = importlib.import_module(tqdm_module_name).tqdm
except Exception:
    tqdm = None

warnings.filterwarnings("ignore")

SEED = 42
np.random.seed(SEED)
random.seed(SEED)


# =========================
# 1) Environment + Paths
# =========================
IN_COLAB = False
drive: Any = None
files: Any = None
try:
    colab_module_name = "google" + "." + "colab"
    colab_mod = importlib.import_module(colab_module_name)
    drive = colab_mod.drive
    files = colab_mod.files
    IN_COLAB = True
except Exception:
    IN_COLAB = False

if IN_COLAB:
    drive.mount("/content/drive", force_remount=True)
    BASE_DIR = Path("/content/drive/MyDrive/TEME_ML_checkpoints")
    REPO_ROOT = Path("/content")
else:
    REPO_ROOT = Path(__file__).resolve().parents[1]
    BASE_DIR = REPO_ROOT / "TEME_ML_checkpoints"

BASE_DIR.mkdir(parents=True, exist_ok=True)
RUN_ID = dt.datetime.now().strftime("%Y%m%d_%H%M%S")
RUN_DIR = BASE_DIR / f"teme_survival_run_{RUN_ID}"
RUN_DIR.mkdir(parents=True, exist_ok=True)

# Colab-safe defaults to avoid long no-output phases.
# You can override any of these through environment variables.
CV_SPLITS = int(os.environ.get("TEME_CV_SPLITS", "3" if IN_COLAB else "5"))
RF_N_ITER = int(os.environ.get("TEME_RF_N_ITER", "24" if IN_COLAB else "70"))
ET_N_ITER = int(os.environ.get("TEME_ET_N_ITER", "24" if IN_COLAB else "70"))
SEARCH_VERBOSE = int(os.environ.get("TEME_SEARCH_VERBOSE", "2" if IN_COLAB else "1"))


def _bool_env(name: str, default: bool = False) -> bool:
    raw = os.environ.get(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "y", "on"}


QUICK_MODE = _bool_env("TEME_QUICK_MODE", default=False)
if QUICK_MODE:
    CV_SPLITS = min(CV_SPLITS, 3)
    RF_N_ITER = min(RF_N_ITER, 12)
    ET_N_ITER = min(ET_N_ITER, 12)


def ckpt(name: str, payload=None, model=None):
    """Save checkpoint json + optional model snapshot."""
    stamp = dt.datetime.now().strftime("%H:%M:%S")
    print(f"[CHECKPOINT {stamp}] {name}")
    if payload is not None:
        with (RUN_DIR / f"{name}.json").open("w", encoding="utf-8") as f:
            json.dump(payload, f, indent=2, default=str)
    if model is not None:
        joblib.dump(model, RUN_DIR / f"{name}.joblib")


ckpt("00_run_started", {
    "run_id": RUN_ID,
    "seed": SEED,
    "run_dir": str(RUN_DIR),
    "in_colab": IN_COLAB,
    "cv_splits": CV_SPLITS,
    "rf_n_iter": RF_N_ITER,
    "et_n_iter": ET_N_ITER,
    "search_verbose": SEARCH_VERBOSE,
    "quick_mode": QUICK_MODE,
    "search_mode": "manual_cv_with_progress",
})


# =========================
# 2) Dataset Discovery
# =========================
def resolve_dataset_path() -> Path:
    """Resolve dataset path with explicit override + local/colab fallbacks."""
    candidates = []

    # Highest-priority explicit override (works in Colab and local).
    override = os.environ.get("TEME_DATASET_PATH", "").strip()
    if override:
        override_path = Path(override)
        if override_path.exists():
            return override_path
        print(f"[DATASET] TEME_DATASET_PATH provided but not found: {override_path}")

    # Canonical repo dataset (preferred)
    candidates.append(REPO_ROOT / "data" / "datasets" / "v_survival_training.csv")

    # Common Colab Drive locations
    if IN_COLAB:
        candidates.extend([
            Path("/content/drive/MyDrive/v_survival_training.csv"),
            Path("/content/drive/MyDrive/TEME/v_survival_training.csv"),
            Path("/content/drive/MyDrive/carbonsense/data/datasets/v_survival_training.csv"),
        ])

    for p in candidates:
        if p.exists():
            return p

    # Colab deep-search fallback in Drive.
    if IN_COLAB:
        drive_root = Path("/content/drive/MyDrive")
        if drive_root.exists():
            matches = list(drive_root.rglob("v_survival_training.csv"))
            if matches:
                matches_sorted = sorted(matches, key=lambda x: len(str(x)))
                print(f"[DATASET] Found via Drive recursive search: {matches_sorted[0]}")
                return matches_sorted[0]

    raise FileNotFoundError(
        "Could not find v_survival_training.csv. Set explicit path with env var "
        "TEME_DATASET_PATH, place file in MyDrive, or upload in Colab."
    )


try:
    DATASET_PATH = resolve_dataset_path()
except FileNotFoundError:
    if IN_COLAB:
        print("[DATASET] Not found in defaults. Please upload v_survival_training.csv now.")
        uploaded = files.upload()
        if not uploaded:
            raise
        up_name = list(uploaded.keys())[0]
        DATASET_PATH = Path(up_name)
    else:
        raise


df = pd.read_csv(DATASET_PATH)
print(f"Loaded dataset from: {DATASET_PATH}")
print(f"Shape: {df.shape}")

ckpt("01_data_loaded", {
    "source": str(DATASET_PATH),
    "shape": df.shape,
    "columns": df.columns.tolist(),
})


# =========================
# 3) Validation + Cleaning
# =========================
TARGET = "survival_ratio"
BASE_FEATURES = [
    "growth_rate_class",
    "drought_score",
    "fire_score",
    "disease_score",
    "planted_count",
]

required = BASE_FEATURES + [TARGET]
missing = [c for c in required if c not in df.columns]
if missing:
    raise ValueError(f"Missing required columns: {missing}")

work = df.copy()
for c in required:
    work[c] = pd.to_numeric(work[c], errors="coerce")

before_rows = len(work)
work = work.dropna(subset=required).copy()
after_rows = len(work)

work[TARGET] = work[TARGET].clip(0.0, 1.0)
work["growth_rate_class"] = work["growth_rate_class"].clip(1, 10)
work["drought_score"] = work["drought_score"].clip(1, 10)
work["fire_score"] = work["fire_score"].clip(1, 10)
work["disease_score"] = work["disease_score"].clip(1, 10)
work["planted_count"] = work["planted_count"].clip(lower=1)

if len(work) < 200:
    print("Warning: dataset is small (<200 rows). Accuracy ceiling may be limited.")

ckpt("02_data_cleaned", {
    "rows_before": before_rows,
    "rows_after": after_rows,
    "rows_dropped": before_rows - after_rows,
    "target_stats": work[TARGET].describe().to_dict(),
})


# =========================
# 4) Feature Engineering
# =========================
def _to_dataframe(X):
    if isinstance(X, pd.DataFrame):
        out = X.copy()
    else:
        out = pd.DataFrame(X, columns=BASE_FEATURES)
    return out


def engineer_features(X):
    """Derived features while preserving TEME runtime base-feature contract."""
    d = _to_dataframe(X)

    for col in BASE_FEATURES:
        if col not in d.columns:
            d[col] = 0.0

    d["abiotic_stress_mean"] = (d["drought_score"] + d["fire_score"]) / 2.0
    d["biotic_stress"] = d["disease_score"]
    d["total_stress"] = d["drought_score"] + d["fire_score"] + d["disease_score"]
    d["stress_x_growth"] = d["total_stress"] * d["growth_rate_class"]
    d["density_log"] = np.log1p(d["planted_count"])
    d["density_sqrt"] = np.sqrt(d["planted_count"])
    d["growth_over_stress"] = d["growth_rate_class"] / (1.0 + d["total_stress"])
    d["drought_fire_interaction"] = d["drought_score"] * d["fire_score"]
    d["disease_fire_interaction"] = d["disease_score"] * d["fire_score"]

    final_cols = BASE_FEATURES + [
        "abiotic_stress_mean",
        "biotic_stress",
        "total_stress",
        "stress_x_growth",
        "density_log",
        "density_sqrt",
        "growth_over_stress",
        "drought_fire_interaction",
        "disease_fire_interaction",
    ]
    return d[final_cols]


def compute_rmse(y_true, y_pred) -> float:
    """Version-safe RMSE helper for mixed scikit-learn environments."""
    try:
        return float(mean_squared_error(y_true, y_pred, squared=False))
    except TypeError:
        return float(np.sqrt(mean_squared_error(y_true, y_pred)))


# =========================
# 5) Split
# =========================
X = work[BASE_FEATURES].copy()
y = work[TARGET].copy()

X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=SEED
)

ckpt("03_split_done", {
    "train_rows": len(X_train),
    "test_rows": len(X_test),
    "target_train_mean": float(y_train.mean()),
    "target_test_mean": float(y_test.mean()),
})


# =========================
# 6) Hyperparameter Tuning
# =========================
cv = KFold(n_splits=CV_SPLITS, shuffle=True, random_state=SEED)

# IMPORTANT: keep single-threaded model fits for Colab stability.
MODEL_N_JOBS = 1

rf_pipe = Pipeline([
    ("fe", FunctionTransformer(engineer_features, validate=False)),
    ("model", RandomForestRegressor(random_state=SEED, n_jobs=MODEL_N_JOBS)),
])

et_pipe = Pipeline([
    ("fe", FunctionTransformer(engineer_features, validate=False)),
    ("model", ExtraTreesRegressor(random_state=SEED, n_jobs=MODEL_N_JOBS)),
])

rf_space = {
    "model__n_estimators": randint(250, 900),
    "model__max_depth": randint(4, 24),
    "model__min_samples_split": randint(2, 20),
    "model__min_samples_leaf": randint(1, 12),
    "model__max_features": uniform(0.4, 0.6),
    "model__bootstrap": [True, False],
}

et_space = {
    "model__n_estimators": randint(250, 1000),
    "model__max_depth": randint(4, 28),
    "model__min_samples_split": randint(2, 20),
    "model__min_samples_leaf": randint(1, 10),
    "model__max_features": uniform(0.4, 0.6),
    "model__bootstrap": [False],
}


def run_search(name, pipe, param_space, n_iter):
    print(f"\n=== Tuning {name} ===")
    t0 = time.time()
    total_fits = n_iter * CV_SPLITS
    print(f"[SEARCH] {name}: n_iter={n_iter}, cv={CV_SPLITS}, total_fits={total_fits}")
    print(f"[SEARCH] parallelism: model_n_jobs={MODEL_N_JOBS} (manual CV loop)")

    samples = list(ParameterSampler(param_space, n_iter=n_iter, random_state=SEED))

    best_cv_mae = float("inf")
    best_params = None
    rows = []

    progress_total = len(samples) * CV_SPLITS
    pbar = None
    if tqdm is not None:
        pbar = tqdm(
            total=progress_total,
            desc=f"{name} tuning",
            unit="fold",
            dynamic_ncols=True,
            mininterval=0.5,
        )

    for i, params in enumerate(samples, start=1):
        iter_start = time.time()
        fold_maes = []

        for fold_idx, (tr_idx, va_idx) in enumerate(cv.split(X_train, y_train), start=1):
            model = clone(pipe)
            model.set_params(**params)

            x_tr = X_train.iloc[tr_idx]
            y_tr = y_train.iloc[tr_idx]
            x_va = X_train.iloc[va_idx]
            y_va = y_train.iloc[va_idx]

            model.fit(x_tr, y_tr)
            pred = np.clip(model.predict(x_va), 0.0, 1.0)
            mae = mean_absolute_error(y_va, pred)
            fold_maes.append(float(mae))

            if pbar is not None:
                pbar.update(1)
                pbar.set_postfix({
                    "iter": f"{i}/{len(samples)}",
                    "fold": f"{fold_idx}/{CV_SPLITS}",
                    "best_mae": f"{best_cv_mae:.4f}" if best_cv_mae < float("inf") else "-",
                    "curr_mae": f"{np.mean(fold_maes):.4f}",
                })

        mean_mae = float(np.mean(fold_maes))
        std_mae = float(np.std(fold_maes))
        iter_sec = time.time() - iter_start

        row = {"rank_test_score": 0, "mean_test_score": -mean_mae, "std_test_score": std_mae, "iter_seconds": iter_sec}
        for k, v in params.items():
            row[f"param_{k}"] = v
        rows.append(row)

        if mean_mae < best_cv_mae:
            best_cv_mae = mean_mae
            best_params = params

        # Heartbeat log every few iterations to avoid silent runs in Colab outputs.
        if i % max(1, len(samples) // 6) == 0 or i == len(samples):
            elapsed = time.time() - t0
            print(
                f"[SEARCH] {name} progress {i}/{len(samples)} | "
                f"current_mae={mean_mae:.4f} | best_mae={best_cv_mae:.4f} | "
                f"elapsed={elapsed/60.0:.2f} min"
            )

    if pbar is not None:
        pbar.close()

    # Final fit on full training split with best params.
    best_model = clone(pipe)
    if best_params:
        best_model.set_params(**best_params)
    best_model.fit(X_train, y_train)

    elapsed = time.time() - t0
    print(f"[SEARCH] {name} done in {elapsed/60.0:.2f} min")

    cv_results = pd.DataFrame(rows)
    cv_results = cv_results.sort_values("mean_test_score", ascending=False).reset_index(drop=True)
    cv_results["rank_test_score"] = np.arange(1, len(cv_results) + 1)
    cv_results.to_csv(RUN_DIR / f"{name}_cv_results.csv", index=False)

    ckpt(f"04_tuned_{name}", {
        "best_cv_mae": float(best_cv_mae),
        "best_params": best_params,
        "n_iter": int(n_iter),
    }, model=best_model)

    return {
        "name": name,
        "best_model": best_model,
        "best_cv_mae": float(best_cv_mae),
        "best_params": best_params,
    }


rf_result = run_search("random_forest", rf_pipe, rf_space, n_iter=RF_N_ITER)
et_result = run_search("extra_trees", et_pipe, et_space, n_iter=ET_N_ITER)


# =========================
# 7) Select + Evaluate
# =========================
candidates = sorted([rf_result, et_result], key=lambda x: x["best_cv_mae"])
best = candidates[0]
final_model = best["best_model"]

pred_test = np.clip(final_model.predict(X_test), 0.0, 1.0)

mae = mean_absolute_error(y_test, pred_test)
rmse = compute_rmse(y_test, pred_test)
r2 = r2_score(y_test, pred_test)

eps = 1e-6
smape = np.mean(
    2.0 * np.abs(pred_test - y_test.values) /
    (np.abs(pred_test) + np.abs(y_test.values) + eps)
)

metrics = {
    "selected_model": best["name"],
    "best_cv_mae": best["best_cv_mae"],
    "test_mae": float(mae),
    "test_rmse": float(rmse),
    "test_r2": float(r2),
    "test_smape": float(smape),
    "best_params": best["best_params"],
    "train_rows": int(len(X_train)),
    "test_rows": int(len(X_test)),
}

print("\n=== Final Metrics ===")
for k, v in metrics.items():
    print(f"{k}: {v}")

ckpt("05_final_metrics", metrics)


# =========================
# 8) Save Artifacts
# =========================
final_model_name = f"rf_survival_v2_{RUN_ID}.pkl"
final_model_path = RUN_DIR / final_model_name
stable_model_path = RUN_DIR / "rf_survival_latest.pkl"

joblib.dump(final_model, final_model_path)
joblib.dump(final_model, stable_model_path)

pred_df = pd.DataFrame({
    "y_true": y_test.values,
    "y_pred": pred_test,
})
pred_df.to_csv(RUN_DIR / "test_predictions.csv", index=False)

# Keep a copy of dataset used in this run for reproducibility + easy download.
dataset_copy_path = RUN_DIR / "v_survival_training_used.csv"
work.to_csv(dataset_copy_path, index=False)

model_card = {
    "run_id": RUN_ID,
    "created_at": dt.datetime.now().isoformat(),
    "task": "TEME survival ratio regression",
    "dataset_source": str(DATASET_PATH),
    "target": TARGET,
    "base_features_runtime": BASE_FEATURES,
    "engineered_features_internal": [
        "abiotic_stress_mean", "biotic_stress", "total_stress", "stress_x_growth",
        "density_log", "density_sqrt", "growth_over_stress",
        "drought_fire_interaction", "disease_fire_interaction",
    ],
    "model_selected": best["name"],
    "metrics": metrics,
    "artifact_paths": {
        "final_model_versioned": str(final_model_path),
        "final_model_stable": str(stable_model_path),
        "predictions_csv": str(RUN_DIR / "test_predictions.csv"),
        "dataset_copy": str(dataset_copy_path),
        "rf_cv_results": str(RUN_DIR / "random_forest_cv_results.csv"),
        "et_cv_results": str(RUN_DIR / "extra_trees_cv_results.csv"),
    },
    "integration_note": (
        "Saved object is sklearn Pipeline. TEME runtime remains compatible because "
        "base runtime features are unchanged."
    ),
}

with (RUN_DIR / "model_card.json").open("w", encoding="utf-8") as f:
    json.dump(model_card, f, indent=2)

ckpt("06_training_complete", model_card)

print("\nTraining complete.")
print(f"Run folder: {RUN_DIR}")
print(f"Use this model in engine: {stable_model_path}")
print(f"Dataset copy for download: {dataset_copy_path}")

# Colab convenience: trigger browser download.
if IN_COLAB:
    try:
        files.download(str(dataset_copy_path))
        print("Triggered Colab dataset download.")
    except Exception as e:
        print(f"Colab auto-download failed: {e}")

# Quick sanity inference.
sample = pd.DataFrame([{
    "growth_rate_class": 7,
    "drought_score": 8,
    "fire_score": 7,
    "disease_score": 8,
    "planted_count": 500,
}])

sample_pred = float(np.clip(final_model.predict(sample)[0], 0.0, 1.0))
print(f"Sanity prediction sample survival_ratio: {sample_pred:.4f}")
