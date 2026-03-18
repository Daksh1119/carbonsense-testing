"""
Train an updated TEME survival RandomForest model from CSV.

Default input:
    data/datasets/v_survival_training.csv
Default output:
  packages/ml_services/teme/ml/models/rf_survival_v1_2.pkl

Usage:
  C:/.../.venv/Scripts/python.exe scripts/train_teme_survival_model.py
"""

from __future__ import annotations

import argparse
import csv
from pathlib import Path


def _load_rows(path: Path):
    with path.open("r", newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        return list(reader)


def main() -> None:
    parser = argparse.ArgumentParser(description="Train TEME RF survival model")
    parser.add_argument("--data", default="data/datasets/v_survival_training.csv")
    parser.add_argument("--out", default="packages/ml_services/teme/ml/models/rf_survival_v1_2.pkl")
    parser.add_argument("--test-size", type=float, default=0.2)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--n-estimators", type=int, default=350)
    parser.add_argument("--max-depth", type=int, default=10)
    parser.add_argument("--min-samples-leaf", type=int, default=4)
    args = parser.parse_args()

    try:
        import numpy as np
        import joblib
        from sklearn.ensemble import RandomForestRegressor
        from sklearn.metrics import mean_absolute_error, r2_score
        from sklearn.model_selection import train_test_split
    except Exception as exc:
        raise SystemExit(
            "Missing dependency for training. Install: scikit-learn, numpy, joblib\n"
            f"Details: {exc}"
        )

    path = Path(args.data)
    if not path.exists():
        raise SystemExit(f"Dataset not found: {path}")

    rows = _load_rows(path)
    if not rows:
        raise SystemExit("Dataset is empty")

    features = [
        "growth_rate_class",
        "drought_score",
        "fire_score",
        "disease_score",
        "planted_count",
    ]

    X = []
    y = []
    for r in rows:
        try:
            X.append([float(r[k]) for k in features])
            y.append(float(r["survival_ratio"]))
        except Exception:
            continue

    if len(X) < 50:
        raise SystemExit(f"Not enough valid rows to train: {len(X)}")

    X_np = np.array(X, dtype=float)
    y_np = np.array(y, dtype=float)

    X_train, X_test, y_train, y_test = train_test_split(
        X_np,
        y_np,
        test_size=args.test_size,
        random_state=args.seed,
    )

    model = RandomForestRegressor(
        n_estimators=args.n_estimators,
        max_depth=args.max_depth,
        min_samples_leaf=args.min_samples_leaf,
        random_state=args.seed,
        n_jobs=-1,
    )
    model.fit(X_train, y_train)

    pred = model.predict(X_test)
    mae = mean_absolute_error(y_test, pred)
    r2 = r2_score(y_test, pred)

    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(model, out_path)

    print("[TEME TRAIN] Training complete")
    print(f"[TEME TRAIN] Rows used      : {len(X_np)}")
    print(f"[TEME TRAIN] MAE            : {mae:.6f}")
    print(f"[TEME TRAIN] R2             : {r2:.6f}")
    print(f"[TEME TRAIN] Model saved to : {out_path}")

    # Feature importance quick view for sanity.
    for name, score in sorted(zip(features, model.feature_importances_), key=lambda x: x[1], reverse=True):
        print(f"[TEME TRAIN] Importance {name:18s}: {score:.4f}")


if __name__ == "__main__":
    main()
