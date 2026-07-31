"""
Correct the mislabeled rows in v_survival_training.csv.

FINDING (confirmed independently twice -- see teme_v4_data_lineage.md):
All 12,000 rows in this file have dataset_version == "teme_survival_v2_synthetic",
including the 63 rows that claim is_synthetic == 0 ("real"). Those 63 rows have
blank species_name, blank region, only 3 unique underlying scenarios repeated
~21 times each, and suspiciously round survival ratios -- every sign of being
synthetic seed data, not field observations. There is no genuinely real data
in this file at all.

This script does not delete anything. It forces row_origin/is_synthetic to
honestly reflect "synthetic" for every row, and writes a new file rather than
overwriting the original, so the mislabeled original remains available for
audit.
"""

from __future__ import annotations

import argparse
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]


def relabel(input_path: Path, output_path: Path) -> dict:
    df = pd.read_csv(input_path, low_memory=False)

    before_real = int((df.get("is_synthetic", 1) == 0).sum())

    df["is_synthetic"] = 1
    df["row_origin"] = "synthetic"
    # dataset_version already honestly says "..._synthetic" -- leave as is,
    # it was correct all along; only the row-level flag was wrong.

    output_path.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(output_path, index=False)

    return {
        "rows_total": len(df),
        "rows_relabeled_from_real_to_synthetic": before_real,
        "rows_already_synthetic": len(df) - before_real,
    }


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Relabel mislabeled legacy rows as synthetic")
    p.add_argument("--in", dest="input_path", default=str(ROOT / "data" / "datasets" / "v_survival_training.csv"))
    p.add_argument("--out", dest="output_path", default=str(ROOT / "data" / "datasets" / "v_survival_training_relabeled.csv"))
    return p.parse_args()


def main() -> None:
    args = parse_args()
    stats = relabel(Path(args.input_path), Path(args.output_path))
    print("[RELABEL] Complete")
    print(f"[RELABEL] Output: {args.output_path}")
    print(f"[RELABEL] Total rows: {stats['rows_total']}")
    print(f"[RELABEL] Rows corrected from mislabeled 'real' -> honest 'synthetic': {stats['rows_relabeled_from_real_to_synthetic']}")
    print(f"[RELABEL] Rows already correctly labeled synthetic: {stats['rows_already_synthetic']}")
    print()
    print("[RELABEL] IMPORTANT: point build_teme_v4_dataset.py's base dataset path at")
    print(f"          {args.output_path}")
    print("          instead of the original v_survival_training.csv from now on.")


if __name__ == "__main__":
    main()