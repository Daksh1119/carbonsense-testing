"""
TEME Ranking Stability Evaluation

Tests whether species recommendations are stable under small
perturbations in input parameters.

Method:
  1. Run optimizer with base inputs
  2. Perturb one parameter at a time (±5-25%)
  3. Re-run optimizer
  4. Measure ranking consistency

Metrics:
  - Top-1 Consistency: % of perturbations where top species stays the same
  - Kendall Tau: Rank correlation between base and perturbed rankings
  - Allocation Stability: max % change in tree count for any species

Target:
  - Top-1 Consistency >= 80%
  - Kendall Tau >= 0.6
"""

import copy
from typing import Dict, List, Tuple, Any

from teme.core.optimizer import select_species_rule_based
from teme.data.species_catalog import SPECIES_CATALOG


# ---------------------------------------------------------------------------
# Perturbation definitions
# ---------------------------------------------------------------------------

PERTURBATION_SETS = [
    # --- Emission perturbations ---
    {
        "name": "Emission ±10% (1000kg base)",
        "base_emission": 1000,
        "base_location": "India",
        "base_constraints": {
            "max_land_area_hectare": 5,
            "preferred_species": None,
            "exclude_species": None,
        },
        "field": "emission_kg",
        "perturbations": [900, 950, 1050, 1100],
    },
    {
        "name": "Emission ±25% (1000kg base)",
        "base_emission": 1000,
        "base_location": "India",
        "base_constraints": {
            "max_land_area_hectare": 5,
            "preferred_species": None,
            "exclude_species": None,
        },
        "field": "emission_kg",
        "perturbations": [750, 850, 1150, 1250],
    },
    # --- Land perturbations ---
    {
        "name": "Land ±10% (5ha base)",
        "base_emission": 1000,
        "base_location": "India",
        "base_constraints": {
            "max_land_area_hectare": 5,
            "preferred_species": None,
            "exclude_species": None,
        },
        "field": "max_land_area_hectare",
        "perturbations": [4.5, 4.75, 5.25, 5.5],
    },
    {
        "name": "Land ±25% (5ha base)",
        "base_emission": 1000,
        "base_location": "India",
        "base_constraints": {
            "max_land_area_hectare": 5,
            "preferred_species": None,
            "exclude_species": None,
        },
        "field": "max_land_area_hectare",
        "perturbations": [3.75, 4.25, 5.75, 6.25],
    },
    # --- Large emission forces multi-species allocation ---
    {
        "name": "Large emission multi-species (10000kg)",
        "base_emission": 10000,
        "base_location": "India",
        "base_constraints": {
            "max_land_area_hectare": 15,
            "preferred_species": None,
            "exclude_species": None,
        },
        "field": "emission_kg",
        "perturbations": [9000, 9500, 10500, 11000],
    },
    # --- Very large emission with tight land forces full diversity ---
    {
        "name": "Tight land forces diversity (5000kg, 2ha)",
        "base_emission": 5000,
        "base_location": "India",
        "base_constraints": {
            "max_land_area_hectare": 2,
            "preferred_species": None,
            "exclude_species": None,
        },
        "field": "emission_kg",
        "perturbations": [4500, 4750, 5250, 5500],
    },
    # --- Exclude top species forces ranking shift ---
    {
        "name": "Without Neem (1000kg)",
        "base_emission": 1000,
        "base_location": "India",
        "base_constraints": {
            "max_land_area_hectare": 5,
            "preferred_species": None,
            "exclude_species": ["Neem"],
        },
        "field": "emission_kg",
        "perturbations": [900, 950, 1050, 1100],
    },
    {
        "name": "Without Neem+Peepal (1000kg)",
        "base_emission": 1000,
        "base_location": "India",
        "base_constraints": {
            "max_land_area_hectare": 5,
            "preferred_species": None,
            "exclude_species": ["Neem", "Peepal"],
        },
        "field": "emission_kg",
        "perturbations": [900, 950, 1050, 1100],
    },
    # --- Preference override ---
    {
        "name": "Prefer Bamboo (1000kg)",
        "base_emission": 1000,
        "base_location": "India",
        "base_constraints": {
            "max_land_area_hectare": 5,
            "preferred_species": ["Bamboo"],
            "exclude_species": None,
        },
        "field": "emission_kg",
        "perturbations": [900, 950, 1050, 1100],
    },
    # --- Small emission range ---
    {
        "name": "Small emission (200kg)",
        "base_emission": 200,
        "base_location": "India",
        "base_constraints": {
            "max_land_area_hectare": 2,
            "preferred_species": None,
            "exclude_species": None,
        },
        "field": "emission_kg",
        "perturbations": [180, 190, 210, 220],
    },
]


# ---------------------------------------------------------------------------
# Ranking extraction and comparison
# ---------------------------------------------------------------------------

def extract_ranking(species_config: Dict[str, Dict]) -> List[str]:
    """Extract species ranked by allocated count (descending)."""
    return sorted(
        species_config.keys(),
        key=lambda s: species_config[s]["count"],
        reverse=True,
    )


def extract_top_species(species_config: Dict[str, Dict]) -> str:
    """Get the species with the most trees allocated."""
    ranking = extract_ranking(species_config)
    return ranking[0] if ranking else ""


def kendall_tau(ranking_a: List[str], ranking_b: List[str]) -> float:
    """
    Compute Kendall Tau rank correlation between two rankings.

    Returns value in [-1, 1]:
      +1 = identical ranking
       0 = no correlation
      -1 = reversed ranking

    Only considers species present in BOTH rankings.
    """
    common = [s for s in ranking_a if s in ranking_b]

    if len(common) < 2:
        return 1.0  # Can't compute with <2 common items

    pos_a = {s: i for i, s in enumerate(ranking_a)}
    pos_b = {s: i for i, s in enumerate(ranking_b)}

    concordant = 0
    discordant = 0

    for i in range(len(common)):
        for j in range(i + 1, len(common)):
            s1, s2 = common[i], common[j]
            a_order = pos_a[s1] - pos_a[s2]
            b_order = pos_b[s1] - pos_b[s2]

            if (a_order > 0 and b_order > 0) or (a_order < 0 and b_order < 0):
                concordant += 1
            elif a_order != 0 and b_order != 0:
                discordant += 1

    n_pairs = concordant + discordant
    if n_pairs == 0:
        return 1.0

    return (concordant - discordant) / n_pairs


def allocation_change_pct(
    base_config: Dict[str, Dict],
    perturbed_config: Dict[str, Dict],
) -> float:
    """
    Max percentage change in tree count for any species between
    base and perturbed configs.
    """
    max_change = 0.0
    all_species = set(base_config.keys()) | set(perturbed_config.keys())

    for sp in all_species:
        base_count = base_config.get(sp, {}).get("count", 0)
        pert_count = perturbed_config.get(sp, {}).get("count", 0)

        if base_count > 0:
            change = abs(pert_count - base_count) / base_count
            max_change = max(max_change, change)
        elif pert_count > 0:
            max_change = max(max_change, 1.0)

    return max_change


# ---------------------------------------------------------------------------
# Run stability evaluation
# ---------------------------------------------------------------------------

def run_ranking_stability_evaluation() -> Dict:
    """
    Run perturbation tests and measure ranking stability.
    """
    print("[TEME EVALUATION] Running ranking stability evaluation...")

    all_results = []
    all_top1_consistent = 0
    all_top1_total = 0
    all_tau_values = []

    for pset in PERTURBATION_SETS:
        name = pset["name"]
        field = pset["field"]
        perturbations = pset["perturbations"]
        base_emission = pset["base_emission"]
        location = pset["base_location"]
        base_constraints = dict(pset["base_constraints"])

        # Run base case
        try:
            base_config = select_species_rule_based(
                emission_kg=base_emission,
                location=location,
                constraints=base_constraints,
            )
        except Exception as e:
            all_results.append({
                "perturbation_set": name,
                "status": "base_error",
                "error": str(e),
            })
            continue

        base_ranking = extract_ranking(base_config)
        base_top = extract_top_species(base_config)
        n_base_species = len(base_config)

        # Run perturbations
        top1_matches = 0
        tau_values = []
        max_alloc_change = 0.0
        perturbation_details = []

        for pert_val in perturbations:
            try:
                pert_constraints = dict(base_constraints)
                if field == "emission_kg":
                    pert_emission = pert_val
                elif field == "max_land_area_hectare":
                    pert_emission = base_emission
                    pert_constraints["max_land_area_hectare"] = pert_val
                else:
                    pert_emission = base_emission

                pert_config = select_species_rule_based(
                    emission_kg=pert_emission,
                    location=location,
                    constraints=pert_constraints,
                )
            except Exception:
                perturbation_details.append({
                    "value": pert_val,
                    "status": "error",
                })
                continue

            pert_ranking = extract_ranking(pert_config)
            pert_top = extract_top_species(pert_config)

            top1_match = (pert_top == base_top)
            if top1_match:
                top1_matches += 1

            tau = kendall_tau(base_ranking, pert_ranking)
            tau_values.append(tau)
            all_tau_values.append(tau)

            alloc_change = allocation_change_pct(base_config, pert_config)
            max_alloc_change = max(max_alloc_change, alloc_change)

            perturbation_details.append({
                "value": pert_val,
                "status": "ok",
                "top_species": pert_top,
                "top1_match": top1_match,
                "kendall_tau": round(tau, 4),
                "max_allocation_change_pct": round(alloc_change * 100, 1),
                "ranking": pert_ranking,
            })

        n_perts = len([d for d in perturbation_details if d["status"] == "ok"])
        top1_consistency = top1_matches / n_perts if n_perts > 0 else 0
        avg_tau = sum(tau_values) / len(tau_values) if tau_values else 0

        all_top1_consistent += top1_matches
        all_top1_total += n_perts

        all_results.append({
            "perturbation_set": name,
            "status": "completed",
            "base_top_species": base_top,
            "base_ranking": base_ranking,
            "n_base_species": n_base_species,
            "n_perturbations": n_perts,
            "top1_consistency": round(top1_consistency, 4),
            "avg_kendall_tau": round(avg_tau, 4),
            "max_allocation_change_pct": round(max_alloc_change * 100, 1),
            "details": perturbation_details,
        })

    # Global metrics
    overall_top1 = (
        all_top1_consistent / all_top1_total if all_top1_total > 0 else 0
    )
    overall_tau = (
        sum(all_tau_values) / len(all_tau_values) if all_tau_values else 0
    )

    report = {
        "overall_top1_consistency": round(overall_top1, 4),
        "overall_avg_kendall_tau": round(overall_tau, 4),
        "top1_target": 0.80,
        "tau_target": 0.60,
        "meets_top1_target": overall_top1 >= 0.80,
        "meets_tau_target": overall_tau >= 0.60,
        "n_perturbation_sets": len(all_results),
        "perturbation_sets": all_results,
    }

    # Print report
    print(f"\n{'='*65}")
    print(f"  TEME RANKING STABILITY REPORT")
    print(f"{'='*65}")
    print(f"  Perturbation sets:         {len(all_results)}")
    print(f"  Overall Top-1 Consistency: {overall_top1*100:.1f}% "
          f"(target: ≥80%)")
    print(f"  Overall Avg Kendall Tau:   {overall_tau:.4f} "
          f"(target: ≥0.60)")
    print(f"  Meets Top-1 target:        "
          f"{'✅ YES' if report['meets_top1_target'] else '❌ NO'}")
    print(f"  Meets Tau target:          "
          f"{'✅ YES' if report['meets_tau_target'] else '❌ NO'}")
    print(f"{'='*65}")

    for pr in all_results:
        if pr["status"] != "completed":
            print(f"\n  ⚠️  {pr['perturbation_set']}: {pr.get('error', 'error')}")
            continue

        icon = "✅" if pr["top1_consistency"] >= 0.80 else "⚠️"
        multi = f" ({pr['n_base_species']} species)" if pr["n_base_species"] > 1 else ""
        print(f"\n  {icon} {pr['perturbation_set']}:")
        print(f"     Base top: {pr['base_top_species']} | "
              f"Ranking: {pr['base_ranking']}{multi}")
        print(f"     Top-1 consistency: {pr['top1_consistency']*100:.0f}% | "
              f"Avg Tau: {pr['avg_kendall_tau']:.4f} | "
              f"Max alloc change: {pr['max_allocation_change_pct']:.0f}%")

    print(f"\n{'='*65}\n")

    return report


if __name__ == "__main__":
    run_ranking_stability_evaluation()