"""
Validate the trained TEME v4 model against the real anchor holdout.

This is a TRUE EXTERNAL holdout check: the real anchor data was never used
during training (neither in the NERC source nor the legacy synthetic data).

The script reads from the PREPARED CSV (real_anchor_prepared_v4.csv) which
has correctly differentiated state-level climate scores (drought_score,
fire_score) derived from published Koeppen classification via
prepare_real_anchor_v4.py -- NOT the raw file with hardcoded flat defaults.

Key metric: coverage_rate -- fraction of real holdout rows whose observed
survival_ratio falls within the model's [p10, p90] uncertainty band.
A well-calibrated model should achieve ~80% coverage.

Usage:
    python scripts/validate_against_real_anchor.py
    python scripts/validate_against_real_anchor.py --model path/to/model.joblib
    python scripts/validate_against_real_anchor.py --holdout data/raw/teme_v4/real_anchor_prepared_v4.csv
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
# Default: read from the prepared CSV which has differentiated per-state climate scores.
# To use the raw file instead, pass --holdout real_anchor_raw.csv (not recommended).
DEFAULT_HOLDOUT = ROOT / "data" / "raw" / "teme_v4" / "real_anchor_prepared_v4.csv"

COL_MAP_PREPARED = {
    # Maps prepared CSV columns -> model input kwargs
    "growth_rate_class": "growth_rate_class",
    "drought_score": "drought_score",
    "fire_score": "fire_score",
    "disease_score": "disease_score",
    "planted_count": "planted_count",
}
COL_MAP_RAW = None  # sentinel: raw file needs derive logic


def _is_prepared_csv(df: pd.DataFrame) -> bool:
    """True if the file has the TEME v4 prepared columns (row_origin etc)."""
    return "row_origin" in df.columns and "drought_score" in df.columns


def load_holdout(path: Path) -> pd.DataFrame:
    df = pd.read_csv(path, low_memory=False)
    if _is_prepared_csv(df):
        # Already prepared -- use as-is, filter to rows with valid target
        usable = df[df["survival_ratio"].notna() & (df["planted_count"] > 0)].copy()
        usable = usable.reset_index(drop=True)
        print(f"[VALIDATE] Using PREPARED CSV with differentiated climate scores")
        return usable
    else:
        # Raw file fallback -- warn and use flat defaults
        print("[VALIDATE] WARNING: raw file detected -- using flat climate score defaults.")
        print("[VALIDATE]          Run prepare_real_anchor_v4.py first for differentiated scores.")
        usable = df[df["Total Plant No"] > 0].copy()
        usable["survival_ratio"] = (usable["Plant Survived"] / usable["Total Plant No"]).clip(0.0, 1.0)
        usable["planted_count"] = usable["Total Plant No"]
        usable["growth_rate_class"] = usable["Plant height"].apply(
            lambda h: float(max(1, min(10, int(round(h))))) if pd.notna(h) and h > 0 else 5.0
        )
        usable["drought_score"] = 5.0
        usable["fire_score"] = 5.0
        usable["disease_score"] = 5.0
        usable["region"] = usable.get("State", "unknown")
        return usable.reset_index(drop=True)


def map_holdout_to_model_inputs(row: pd.Series) -> dict:
    """
    Read model input kwargs directly from the prepared CSV row.
    All score columns are already correctly populated by prepare_real_anchor_v4.py.
    """
    return {
        "growth_rate_class": float(row.get("growth_rate_class", 5.0)),
        "drought_score": float(row.get("drought_score", 5.0)),
        "fire_score": float(row.get("fire_score", 5.0)),
        "disease_score": float(row.get("disease_score", 5.0)),
        "planted_count": int(row.get("planted_count", 100)),
    }


def run_validation(model_path: Path, holdout_path: Path) -> dict:  # noqa: C901
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
    state_col = "region" if "region" in holdout.columns else "State" if "State" in holdout.columns else None
    for idx, row in holdout.iterrows():
        inputs = map_holdout_to_model_inputs(row)
        pred = predict_v4(bundle, **inputs)
        observed = row["survival_ratio"]
        covered = pred["p10"] <= observed <= pred["p90"]
        results.append({
            "state": row.get(state_col, "unknown") if state_col else "unknown",
            "drought_score_used": inputs["drought_score"],
            "fire_score_used": inputs["fire_score"],
            "planted": int(row.get("planted_count", row.get("Total Plant No", 0))),
            "survived": int(row.get("actual_alive_count", row.get("Plant Survived", 0))),
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
