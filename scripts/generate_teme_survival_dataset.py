"""
Generate one single large TEME survival training dataset aligned with current schema.

Output:
- data/datasets/v_survival_training.csv
    Large extended dataset containing both legacy training fields and metadata.

Usage:
    C:/.../.venv/Scripts/python.exe scripts/generate_teme_survival_dataset.py
    C:/.../.venv/Scripts/python.exe scripts/generate_teme_survival_dataset.py --target-rows 12000 --seed 42
"""

from __future__ import annotations

import argparse
import csv
import math
import random
import uuid
from datetime import date, timedelta
from pathlib import Path
from typing import Dict, List, Tuple

ROOT = Path(__file__).resolve().parents[1]
PACKAGES_DIR = ROOT / "packages"

import sys
if str(PACKAGES_DIR) not in sys.path:
    sys.path.insert(0, str(PACKAGES_DIR))

from packages.ml_services.teme.data.species_catalog import SPECIES_CATALOG
from packages.ml_services.teme.calibration.validation_data import get_all_validation_pairs

BASE_COLUMNS = [
    "species_id",
    "growth_rate_class",
    "drought_score",
    "fire_score",
    "disease_score",
    "planted_count",
    "actual_alive_count",
    "actual_dead_count",
    "survival_ratio",
    "observation_date",
]

EXTENDED_COLUMNS = BASE_COLUMNS + [
    "species_name",
    "region",
    "region_drought_risk",
    "region_fire_risk",
    "region_disease_risk",
    "years_tracked",
    "ground_truth_observed_survival",
    "source",
    "is_synthetic",
    "dataset_version",
]


def _clip(v: float, low: float, high: float) -> float:
    return max(low, min(high, v))


def _clip_int(v: float, low: int, high: int) -> int:
    return int(_clip(round(v), low, high))


def _stable_species_id(species_name: str) -> str:
    return str(uuid.uuid5(uuid.NAMESPACE_DNS, f"teme:{species_name.lower()}"))


def _random_date(rng: random.Random, start: date, end: date) -> str:
    span = (end - start).days
    offset = rng.randint(0, max(span, 0))
    return (start + timedelta(days=offset)).isoformat()


def _weighted_allocation(total: int, weights: List[float]) -> List[int]:
    if total <= 0:
        return [0] * len(weights)
    if not weights or sum(weights) <= 0:
        base = total // max(len(weights), 1)
        out = [base] * len(weights)
        for i in range(total - sum(out)):
            out[i % len(out)] += 1
        return out

    raw = [total * (w / sum(weights)) for w in weights]
    ints = [int(math.floor(x)) for x in raw]
    remainder = total - sum(ints)
    frac_idx = sorted(range(len(raw)), key=lambda i: (raw[i] - ints[i]), reverse=True)
    for i in range(remainder):
        ints[frac_idx[i]] += 1
    return ints


def _simulate_row(
    rng: random.Random,
    pair: Dict,
    catalog_entry: Dict,
    dataset_version: str,
) -> Dict[str, str]:
    # Species baseline traits from current TEME catalog.
    base_growth = int(catalog_entry["growth_rate_class"])
    base_drought = int(catalog_entry["drought_score"])
    base_fire = int(catalog_entry["fire_score"])
    base_disease = int(catalog_entry["disease_score"])

    # Regional hazard signal from calibration data.
    risk_d = int(pair["drought_risk"])
    risk_f = int(pair["fire_risk"])
    risk_di = int(pair["disease_risk"])

    # Perturb resilience scores by local risk + measurement noise.
    drought_eff = _clip_int(base_drought - 0.30 * (risk_d - 5) + rng.gauss(0, 0.9), 1, 10)
    fire_eff = _clip_int(base_fire - 0.30 * (risk_f - 5) + rng.gauss(0, 0.9), 1, 10)
    disease_eff = _clip_int(base_disease - 0.30 * (risk_di - 5) + rng.gauss(0, 0.9), 1, 10)
    growth_eff = _clip_int(base_growth + rng.gauss(0, 0.8), 1, 10)

    planted = int(rng.triangular(40, 1500, 220))

    observed = float(pair["observed_survival"])

    # Create a smooth target generator tied to traits + operational scale.
    resilience_delta = ((drought_eff + fire_eff + disease_eff) - (base_drought + base_fire + base_disease)) / 30.0
    growth_delta = (growth_eff - base_growth) / 10.0
    scale_penalty = max(0.0, (planted - 500) / 2500.0)

    survival = (
        observed
        + 0.08 * resilience_delta
        + 0.03 * growth_delta
        - 0.05 * scale_penalty
        + rng.gauss(0, 0.025)
    )
    survival = _clip(survival, 0.35, 0.98)

    alive = int(round(planted * survival))
    alive = min(max(alive, 0), planted)
    dead = planted - alive

    obs_date = _random_date(
        rng=rng,
        start=date(2024, 1, 1),
        end=date.today(),
    )

    row = {
        "species_id": _stable_species_id(pair["species"]),
        "growth_rate_class": str(growth_eff),
        "drought_score": str(drought_eff),
        "fire_score": str(fire_eff),
        "disease_score": str(disease_eff),
        "planted_count": str(planted),
        "actual_alive_count": str(alive),
        "actual_dead_count": str(dead),
        "survival_ratio": f"{alive / planted:.12f}",
        "observation_date": obs_date,
        "species_name": pair["species"],
        "region": pair["region"],
        "region_drought_risk": str(risk_d),
        "region_fire_risk": str(risk_f),
        "region_disease_risk": str(risk_di),
        "years_tracked": str(pair["years_tracked"]),
        "ground_truth_observed_survival": f"{observed:.6f}",
        "source": pair["source"],
        "is_synthetic": "1",
        "dataset_version": dataset_version,
    }
    return row


def _read_base_rows(path: Path) -> List[Dict[str, str]]:
    if not path.exists():
        return []
    with path.open("r", newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        return list(reader)


def _base_to_extended(row: Dict[str, str], dataset_version: str) -> Dict[str, str]:
    out = {k: row.get(k, "") for k in BASE_COLUMNS}
    out.update(
        {
            "species_name": "",
            "region": "",
            "region_drought_risk": "",
            "region_fire_risk": "",
            "region_disease_risk": "",
            "years_tracked": "",
            "ground_truth_observed_survival": row.get("survival_ratio", ""),
            "source": "legacy_base_dataset",
            "is_synthetic": "0",
            "dataset_version": dataset_version,
        }
    )
    return out


def generate_dataset(
    base_csv: Path,
    out_csv: Path,
    target_rows: int,
    seed: int,
) -> Tuple[int, int, int]:
    rng = random.Random(seed)
    dataset_version = "teme_survival_v2_synthetic"

    base_rows = _read_base_rows(base_csv)

    # Build species-region pairs with complete catalog support.
    all_pairs = get_all_validation_pairs()
    usable_pairs = [p for p in all_pairs if p["species"] in SPECIES_CATALOG]

    # If target_rows is smaller than base, keep base and skip synthesis.
    synthetic_needed = max(0, target_rows - len(base_rows))

    # Allocate synthetic rows proportional to sample size in validation data.
    weights = [float(p["sample_size"]) for p in usable_pairs]
    allocations = _weighted_allocation(synthetic_needed, weights)

    synthetic_rows: List[Dict[str, str]] = []
    for pair, n in zip(usable_pairs, allocations):
        cfg = SPECIES_CATALOG[pair["species"]]
        for _ in range(n):
            synthetic_rows.append(_simulate_row(rng, pair, cfg, dataset_version))

    # Build one extended table with metadata (single canonical dataset).
    extended_rows = []
    for row in base_rows:
        extended_rows.append(_base_to_extended(row, dataset_version))
    extended_rows.extend(synthetic_rows)

    out_csv.parent.mkdir(parents=True, exist_ok=True)
    with out_csv.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=EXTENDED_COLUMNS)
        writer.writeheader()
        writer.writerows(extended_rows)

    return len(base_rows), len(synthetic_rows), len(extended_rows)


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate one large extended TEME survival training dataset")
    parser.add_argument("--base", default=str(ROOT / "data" / "datasets" / "v_survival_training.csv"))
    parser.add_argument("--target-rows", type=int, default=12000)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--out", default=str(ROOT / "data" / "datasets" / "v_survival_training.csv"))

    args = parser.parse_args()

    base_rows, synthetic_rows, total_rows = generate_dataset(
        base_csv=Path(args.base),
        out_csv=Path(args.out),
        target_rows=max(args.target_rows, 0),
        seed=args.seed,
    )

    print("[TEME DATASET] Generation complete")
    print(f"[TEME DATASET] Base rows used     : {base_rows}")
    print(f"[TEME DATASET] Synthetic rows     : {synthetic_rows}")
    print(f"[TEME DATASET] Total rows         : {total_rows}")
    print(f"[TEME DATASET] Dataset path       : {args.out}")


if __name__ == "__main__":
    main()
