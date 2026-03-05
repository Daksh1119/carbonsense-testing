"""
TEME Ranking Stability Test

Perturbs input parameters slightly and checks whether the
species ranking remains stable.

Perturbations:
  - annual_survival_rate ± 3%
  - peak_sequestration_kg ± 5%
  - maturity_years ± 1

Metrics:
  - Top-1 consistency %  (how often rank-1 species stays the same)
  - Kendall Tau correlation (rank order similarity)

If ranking flips wildly under small changes → unstable system.
"""

import copy
import random
from typing import Dict, List

from teme.core.engine import run_teme
from teme.data.species_catalog import SPECIES_CATALOG


def kendall_tau(ranking_a: List[str], ranking_b: List[str]) -> float:
    """
    Kendall Tau correlation between two ranked lists.
    Returns value in [-1, 1]. 1 = identical ranking.
    """
    common = [s for s in ranking_a if s in ranking_b]
    if len(common) < 2:
        return 1.0  # Not enough to compare

    n = len(common)
    concordant = 0
    discordant = 0

    rank_a = {s: i for i, s in enumerate(ranking_a) if s in common}
    rank_b = {s: i for i, s in enumerate(ranking_b) if s in common}

    for i in range(n):
        for j in range(i + 1, n):
            s1 = common[i]
            s2 = common[j]
            a_diff = rank_a[s1] - rank_a[s2]
            b_diff = rank_b[s1] - rank_b[s2]
            if a_diff * b_diff > 0:
                concordant += 1
            elif a_diff * b_diff < 0:
                discordant += 1

    total = concordant + discordant
    if total == 0:
        return 1.0

    return (concordant - discordant) / total


def extract_ranking(engine_result: Dict) -> List[str]:
    """
    Extract species ranking from engine output.
    Ranked by contribution to total offset (count × peak_seq × survival).
    """
    plan = engine_result["offset_plan"]
    scored = []
    for entry in plan:
        species = entry["species"]
        count = entry["count"]
        # Use last value of sequestration curve as peak indicator
        seq = entry["annual_sequestration_kg"]
        peak = max(seq) if seq else 0
        surv = entry["survival_curve"]
        surv_10 = surv[min(10, len(surv) - 1)]
        score = count * peak * surv_10
        scored.append((species, score))

    scored.sort(key=lambda x: x[1], reverse=True)
    return [s[0] for s in scored]


def create_perturbed_catalog(
    rng: random.Random,
    survival_pct: float = 0.03,
    seq_pct: float = 0.05,
    maturity_delta: int = 1,
) -> Dict:
    """
    Create a perturbed copy of SPECIES_CATALOG.
    Each species gets independent random perturbations.
    """
    perturbed = {}
    for name, data in SPECIES_CATALOG.items():
        new_data = copy.deepcopy(data)

        # Perturb survival rate ± survival_pct
        surv = new_data["annual_survival_rate"]
        surv *= 1 + rng.uniform(-survival_pct, survival_pct)
        new_data["annual_survival_rate"] = max(0.50, min(0.99, surv))

        # Perturb peak sequestration ± seq_pct
        seq = new_data["peak_sequestration_kg"]
        seq *= 1 + rng.uniform(-seq_pct, seq_pct)
        new_data["peak_sequestration_kg"] = max(1.0, seq)

        # Perturb maturity ± maturity_delta
        mat = new_data["maturity_years"]
        mat += rng.randint(-maturity_delta, maturity_delta)
        new_data["maturity_years"] = max(1, mat)

        perturbed[name] = new_data

    return perturbed


def run_ranking_stability(
    n_perturbations: int = 100,
    seed: int = 42,
) -> Dict:
    """
    Run ranking stability analysis.

    1. Get baseline ranking
    2. Perturb catalog 100 times
    3. Compare each perturbed ranking to baseline
    """
    rng = random.Random(seed)

    base_payload = {
        "emission_kg": 1000,
        "location": "India",
        "time_horizon_years": 20,
        "constraints": {"max_land_area_hectare": 5},
    }

    # --- Baseline ranking ---
    base_result = run_teme(base_payload)
    base_ranking = extract_ranking(base_result)
    base_top1 = base_ranking[0] if base_ranking else None

    # --- Perturbed runs ---
    import teme.data.species_catalog as catalog_module
    original_catalog = copy.deepcopy(SPECIES_CATALOG)

    top1_matches = 0
    tau_scores = []

    for i in range(n_perturbations):
        # Swap catalog with perturbed version
        perturbed = create_perturbed_catalog(rng)
        catalog_module.SPECIES_CATALOG = perturbed

        try:
            result = run_teme(base_payload)
            ranking = extract_ranking(result)

            if ranking and ranking[0] == base_top1:
                top1_matches += 1

            tau = kendall_tau(base_ranking, ranking)
            tau_scores.append(tau)

        except Exception:
            # Perturbation made plan infeasible — skip
            pass

    # Restore original catalog
    catalog_module.SPECIES_CATALOG = original_catalog

    top1_consistency = top1_matches / n_perturbations if n_perturbations > 0 else 0
    avg_tau = sum(tau_scores) / len(tau_scores) if tau_scores else 0

    return {
        "metric": "ranking_stability",
        "n_perturbations": n_perturbations,
        "base_ranking": base_ranking,
        "base_top1": base_top1,
        "top1_consistency": round(top1_consistency, 4),
        "top1_consistency_pct": round(top1_consistency * 100, 1),
        "avg_kendall_tau": round(avg_tau, 4),
        "min_kendall_tau": round(min(tau_scores), 4) if tau_scores else None,
        "max_kendall_tau": round(max(tau_scores), 4) if tau_scores else None,
        "target": "Top-1 consistency > 80%, Avg Tau > 0.6",
        "passed": top1_consistency > 0.80 and avg_tau > 0.6,
        "valid_runs": len(tau_scores),
    }