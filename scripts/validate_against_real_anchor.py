"""
Validate the trained TEME v4 model against the real_anchor_raw.csv holdout.

This is a TRUE EXTERNAL holdout check: real_anchor_raw.csv was never used
during training (neither in the NERC source nor the legacy synthetic data).
Only rows with Total Plant No > 0 are usable (the rest are pure expenditure
records with no survival outcome).

Key metric: coverage_rate -- fraction of real holdout rows whose observed
survival_ratio falls within the model's [p10, p90] uncertainty band.
A well-calibrated model should achieve ~80% coverage.

Usage:
    python scripts/validate_against_real_anchor.py
    python scripts/validate_against_real_anchor.py --model path/to/model.joblib
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import joblib
import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
PACKAGES_DIR = ROOT / "packages"
if str(PACKAGES_DIR) not in sys.path:
    sys.path.insert(0, str(PACKAGES_DIR))

from ml_services.teme.ml.survival_v4 import predict_v4

DEFAULT_MODEL = ROOT / "packages" / "ml_services" / "teme" / "ml" / "models" / "teme_survival_v4.joblib"
DEFAULT_HOLDOUT = ROOT / "real_anchor_raw.csv"


def load_holdout(path: Path) -> pd.DataFrame:
    df = pd.read_csv(path, low_memory=False)
    # Only rows with actual plant data
    usable = df[df["Total Plant No"] > 0].copy()
    usable["survival_ratio"] = (usable["Plant Survived"] / usable["Total Plant No"]).clip(0.0, 1.0)
    return usable.reset_index(drop=True)


def map_holdout_to_model_inputs(row: pd.Series) -> dict:
    """
    Best-effort mapping from real_anchor_raw columns to model features.
    real_anchor_raw has no species, no drought/fire/disease scores --
    use neutral defaults (5) so the model prediction is driven primarily
    by planted_count and growth_rate_class (derived from Plant height).
    """
    # Rough growth_rate_class from Plant height (integer cm values)
    height = row.get("Plant height", np.nan)
    if pd.notna(height) and height > 0:
        # Map height 1-10 to growth_rate_class 1-10 (clamped)
        growth_rate_class = max(1, min(10, int(round(height))))
    else:
        growth_rate_class = 5  # neutral default

    return {
        "growth_rate_class": growth_rate_class,
        "drought_score": 5,    # no data -- neutral
        "fire_score": 3,       # Indian plantation, assume low-moderate
        "disease_score": 5,    # no data -- neutral
        "planted_count": int(row["Total Plant No"]),
    }


def run_validation(model_path: Path, holdout_path: Path) -> dict:
    print(f"[VALIDATE] Loading model: {model_path}")
    bundle = joblib.load(model_path)
    model_version = bundle.get("metadata", {}).get("version", "unknown")
    print(f"[VALIDATE] Model version: {model_version}")

    print(f"[VALIDATE] Loading holdout: {holdout_path}")
    holdout = load_holdout(holdout_path)
    print(f"[VALIDATE] Usable holdout rows (Total Plant No > 0): {len(holdout)}")

    if len(holdout) == 0:
        print("[VALIDATE] ERROR: no usable holdout rows.")
        return {"error": "no usable rows", "n_usable": 0}

    results = []
    for idx, row in holdout.iterrows():
        inputs = map_holdout_to_model_inputs(row)
        pred = predict_v4(bundle, **inputs)
        observed = row["survival_ratio"]
        covered = pred["p10"] <= observed <= pred["p90"]
        results.append({
            "state": row.get("State", "unknown"),
            "year": row.get("Year", "unknown"),
            "stage": row.get("Stage", "unknown"),
            "planted": int(row["Total Plant No"]),
            "survived": int(row["Plant Survived"]),
            "observed_survival": round(observed, 4),
            "predicted_point": round(pred["point"], 4),
            "p10": round(pred["p10"], 4),
            "p90": round(pred["p90"], 4),
            "covered": bool(covered),
            "residual": round(pred["point"] - observed, 4),
        })

    results_df = pd.DataFrame(results)
    n_total = len(results_df)
    n_covered = int(results_df["covered"].sum())
    coverage_rate = n_covered / n_total
    mae = float(results_df["residual"].abs().mean())

    print()
    print("[VALIDATE] === External Holdout Results ===")
    print(f"  Holdout rows     : {n_total}")
    print(f"  Covered by [p10,p90] : {n_covered}/{n_total}")
    print(f"  ** coverage_rate : {coverage_rate:.4f} ({coverage_rate*100:.1f}%) **")
    print(f"  MAE (point vs observed) : {mae:.4f}")
    print()
    print("[VALIDATE] Per-row detail:")
    print(results_df.to_string(index=False))

    report = {
        "model_version": model_version,
        "model_path": str(model_path),
        "holdout_path": str(holdout_path),
        "n_holdout_rows": n_total,
        "n_covered": n_covered,
        "coverage_rate": round(coverage_rate, 4),
        "mae": round(mae, 4),
        "rows": results,
    }
    return report


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Validate TEME v4 against real anchor holdout")
    p.add_argument("--model", default=str(DEFAULT_MODEL))
    p.add_argument("--holdout", default=str(DEFAULT_HOLDOUT))
    return p.parse_args()


def main() -> None:
    args = parse_args()
    report = run_validation(Path(args.model), Path(args.holdout))

    # Save report
    out_path = ROOT / "TEME_ML_checkpoints" / "holdout_validation_report.json"
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(f"\n[VALIDATE] Report saved: {out_path}")


if __name__ == "__main__":
    main()
