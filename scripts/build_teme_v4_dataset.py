"""
build_teme_v4_dataset.py

Merges all sources listed in data/raw/teme_v4/source_manifest.json into a
single canonical training dataset, writes it to:
    data/datasets/v_survival_training_v4.csv

Also writes a composition report to:
    data/datasets/v_survival_training_v4_report.json

Usage:
    python scripts/build_teme_v4_dataset.py
    python scripts/build_teme_v4_dataset.py --strict-composition
    python scripts/build_teme_v4_dataset.py --manifest data/raw/teme_v4/source_manifest.json

--strict-composition flag causes the script to exit with code 1 if any
required source file is missing (default: warn and continue with what's
available).
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import sys
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]

DEFAULT_MANIFEST = ROOT / "data" / "raw" / "teme_v4" / "source_manifest.json"
DEFAULT_OUT_CSV = ROOT / "data" / "datasets" / "v_survival_training_v4.csv"
DEFAULT_OUT_REPORT = ROOT / "data" / "datasets" / "v_survival_training_v4_report.json"

REQUIRED_COLUMNS = [
    "survival_ratio",
    "growth_rate_class",
    "drought_score",
    "fire_score",
    "disease_score",
    "planted_count",
    "row_origin",
]


def _load_source(entry: dict, strict: bool) -> pd.DataFrame | None:
    """Load a single source CSV relative to ROOT, applying column_map and defaults."""
    path = ROOT / entry["path"]
    if not path.exists():
        msg = f"[BUILD V4] WARNING: source file not found: {path}"
        if strict:
            print(f"[BUILD V4] ERROR (--strict-composition): {path}")
            sys.exit(1)
        print(msg)
        return None

    try:
        df = pd.read_csv(path, low_memory=False)
    except Exception as e:
        print(f"[BUILD V4] WARNING: could not read {path}: {e}")
        if strict:
            sys.exit(1)
        return None

    # Apply column renames
    col_map = entry.get("column_map", {})
    if col_map:
        df = df.rename(columns=col_map)

    # Apply defaults for missing columns
    defaults = entry.get("defaults", {})
    for col, val in defaults.items():
        if col not in df.columns:
            df[col] = val

    # Force row_origin from manifest if not already present
    if "row_origin" not in df.columns:
        df["row_origin"] = entry.get("row_origin", "synthetic")

    return df


def _validate_and_report(df: pd.DataFrame) -> dict:
    """Check required columns, compute composition statistics."""
    missing_cols = [c for c in REQUIRED_COLUMNS if c not in df.columns]
    if missing_cols:
        print(f"[BUILD V4] WARNING: merged dataset missing required columns: {missing_cols}")

    n_total = len(df)
    origin_counts = df["row_origin"].value_counts().to_dict() if "row_origin" in df.columns else {}
    n_real = origin_counts.get("real", 0)
    n_synthetic = n_total - n_real

    version_counts = df["dataset_version"].value_counts().to_dict() if "dataset_version" in df.columns else {}
    n_valid_target = int(df["survival_ratio"].notna().sum()) if "survival_ratio" in df.columns else 0

    return {
        "built_at_utc": dt.datetime.now(dt.timezone.utc).isoformat(),
        "total_rows": n_total,
        "rows_real": n_real,
        "rows_synthetic": n_synthetic,
        "real_fraction": round(n_real / n_total, 4) if n_total > 0 else 0.0,
        "rows_with_valid_target": n_valid_target,
        "missing_required_columns": missing_cols,
        "origin_breakdown": origin_counts,
        "dataset_version_breakdown": version_counts,
        "output_csv": str(DEFAULT_OUT_CSV),
    }


def build(manifest_path: Path, out_csv: Path, out_report: Path, strict: bool) -> None:
    if not manifest_path.exists():
        print(f"[BUILD V4] ERROR: manifest not found: {manifest_path}")
        sys.exit(1)

    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    sources = manifest.get("sources", [])

    if not sources:
        print("[BUILD V4] ERROR: manifest contains no sources.")
        sys.exit(1)

    frames = []
    loaded_names = []
    skipped_names = []

    for entry in sources:
        name = entry.get("name", entry.get("path", "unknown"))
        print(f"[BUILD V4] Loading source: {name}")
        df = _load_source(entry, strict=strict)
        if df is not None:
            frames.append(df)
            loaded_names.append(name)
            print(f"[BUILD V4]   -> {len(df)} rows loaded from {name}")
        else:
            skipped_names.append(name)

    if not frames:
        print("[BUILD V4] ERROR: no source frames loaded. Aborting.")
        sys.exit(1)

    merged = pd.concat(frames, ignore_index=True, sort=False)
    print(f"[BUILD V4] Merged total rows: {len(merged)}")

    report = _validate_and_report(merged)
    report["sources_loaded"] = loaded_names
    report["sources_skipped"] = skipped_names

    out_csv.parent.mkdir(parents=True, exist_ok=True)
    merged.to_csv(out_csv, index=False)
    print(f"[BUILD V4] Dataset written: {out_csv}")

    out_report.parent.mkdir(parents=True, exist_ok=True)
    out_report.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(f"[BUILD V4] Report  written: {out_report}")

    print()
    print("[BUILD V4] === Composition Summary ===")
    print(f"  Total rows  : {report['total_rows']}")
    print(f"  Real rows   : {report['rows_real']}  ({report['real_fraction']*100:.1f}%)")
    print(f"  Synthetic   : {report['rows_synthetic']}")
    print(f"  Valid target: {report['rows_with_valid_target']}")
    if report["missing_required_columns"]:
        print(f"  MISSING COLS: {report['missing_required_columns']}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build TEME v4 canonical training dataset")
    parser.add_argument("--manifest", default=str(DEFAULT_MANIFEST))
    parser.add_argument("--out", default=str(DEFAULT_OUT_CSV))
    parser.add_argument("--report", default=str(DEFAULT_OUT_REPORT))
    parser.add_argument(
        "--strict-composition",
        action="store_true",
        help="Exit with code 1 if any source file is missing (default: warn and continue)",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    build(
        manifest_path=Path(args.manifest),
        out_csv=Path(args.out),
        out_report=Path(args.report),
        strict=args.strict_composition,
    )


if __name__ == "__main__":
    main()
