from typing import Dict, Any, Optional
from ml_services.teme.data.species_catalog import SPECIES_CATALOG


def select_species_rule_based(
    emission_kg: float,
    location: str,
    constraints: Dict[str, Any],
    time_horizon_years: int = 15,
    project_goal: Optional[str] = None,
) -> Dict[str, Dict[str, Any]]:
    """
    Rule-based species selection for TEME.

    Selects viable species based on location, ranks by priority,
    and allocates trees proportional to emission target.

    Args:
        emission_kg: CO2 emission to offset (kg)
        location: planting region string
        constraints: dict with max_land_area_hectare, preferred_species, exclude_species
        time_horizon_years: projection years (used for calibrated tree estimate)
        project_goal: optional goal key — one of:
            'fastest_offset', 'lowest_cost', 'drought_resilient',
            'native_species', 'biodiversity'

    Returns species_config compatible with engine.run_teme
    """

    max_land = constraints["max_land_area_hectare"]
    preferred = set(constraints.get("preferred_species") or [])
    excluded = set(constraints.get("exclude_species") or [])

    # --- Filter viable species ---
    viable_species = {
        name: data
        for name, data in SPECIES_CATALOG.items()
        if location in data["regions"]
        and name not in excluded
    }

    if not viable_species:
        print(f"[TEME OPTIMIZER ERROR] No viable species for location='{location}'")
        raise ValueError(f"No viable species for given location: {location}")

    print(f"[TEME OPTIMIZER] Found {len(viable_species)} viable species "
          f"for location='{location}': {list(viable_species.keys())}")

    # --- Rank species ---
    def score(item):
        name, data = item
        base = data["priority"]
        if name in preferred:
            base += 0.15
        # Project goal adjustments
        if project_goal == "fastest_offset":
            # Reward fast-maturing + fast-growing species
            maturity_factor = max(0.0, (15 - data["maturity_years"]) / 15)
            base += 0.15 * maturity_factor + 0.05 * (data["growth_rate_class"] / 10)
        elif project_goal == "lowest_cost":
            # Reward lowest planting cost per tree
            cost = data.get("cost_per_tree_total_inr", 500)
            cost_factor = max(0.0, (800 - cost) / 800)
            base += 0.20 * cost_factor
        elif project_goal == "drought_resilient":
            # Reward drought-tolerant species
            base += 0.20 * (data["drought_score"] / 10)
        elif project_goal == "native_species":
            # Penalise introduced/invasive species
            non_native = {"Eucalyptus", "Casuarina", "Acacia"}
            if name in non_native:
                base -= 0.30
        elif project_goal == "biodiversity":
            # Reward species with broader ecological value
            eco_score = (data["drought_score"] + data["disease_score"]) / 20
            base += 0.08 * eco_score
        return base

    ranked = sorted(
        viable_species.items(),
        key=score,
        reverse=True
    )

    print(f"[TEME OPTIMIZER] Ranking order: "
          f"{[name for name, _ in ranked]}")

    # --- Estimate trees needed based on emission amount ---
    top_species = ranked[0][1]
    maturity = top_species["maturity_years"]
    peak = top_species["peak_sequestration_kg"]
    survival = top_species["annual_survival_rate"]

    # Time-horizon-aware tree estimation:
    # Integrate approximate offset per tree over the actual planning horizon,
    # discounted by mid-horizon compound survival, with 2.0x safety buffer.
    ramp_years = min(time_horizon_years, maturity)
    plateau_years = max(0, time_horizon_years - maturity)
    raw_per_tree = peak * ramp_years / 2.0 + peak * plateau_years
    mid_survival = survival ** (time_horizon_years / 2.0)
    effective_per_tree = raw_per_tree * mid_survival

    if effective_per_tree > 0:
        estimated_trees_needed = int((emission_kg / effective_per_tree) * 2.0)
        estimated_trees_needed = max(estimated_trees_needed, 5)
    else:
        estimated_trees_needed = 10000

    # Portfolio diversification cap: limit first species to preserve ecological mix.
    # E.g. 3+ viable species → top species gets at most 60% of tree budget.
    n_viable = len(viable_species)
    if n_viable >= 3:
        max_single_species_trees = max(2, int(estimated_trees_needed * 0.60))
    elif n_viable == 2:
        max_single_species_trees = max(2, int(estimated_trees_needed * 0.75))
    else:
        max_single_species_trees = estimated_trees_needed  # no cap for single species

    print(f"[TEME OPTIMIZER] Emission target: {emission_kg} kg CO2")
    print(
        "[TEME OPTIMIZER] Effective per-tree horizon offset (est): "
        f"{effective_per_tree:.2f} kg over {time_horizon_years} years"
    )
    print(
        "[TEME OPTIMIZER] Estimated trees needed "
        f"(2.0x safety): {estimated_trees_needed}"
    )

    # --- Allocate land greedily (capped by emission need) ---
    remaining_land = max_land
    remaining_trees = estimated_trees_needed
    species_config = {}

    for name, data in ranked:
        if remaining_trees <= 0:
            print(f"[TEME OPTIMIZER] Tree budget exhausted, stopping allocation")
            break

        land_per_tree = data["land_per_tree"]
        if land_per_tree <= 0:
            print(f"[TEME OPTIMIZER WARNING] Skipping '{name}': "
                  f"land_per_tree={land_per_tree}")
            continue

        max_trees_by_land = int(remaining_land / land_per_tree)
        if max_trees_by_land <= 0:
            print(f"[TEME OPTIMIZER] No land left for '{name}', skipping")
            continue

        # Apply diversification cap only to the first allocated species
        is_first = len(species_config) == 0
        allocation_cap = max_single_species_trees if is_first else remaining_trees
        allocated = min(max_trees_by_land, allocation_cap)

        species_config[name] = {
            "count": allocated,
            "maturity_years": data["maturity_years"],
            "peak_sequestration_kg": data["peak_sequestration_kg"],
            "annual_survival_rate": data["annual_survival_rate"],
            "land_per_tree": land_per_tree,
            "growth_rate_class": data.get("growth_rate_class", 5),
            "drought_score": data.get("drought_score", 5),
            "fire_score": data.get("fire_score", 5),
            "disease_score": data.get("disease_score", 5),
        }

        land_used = allocated * land_per_tree
        remaining_land -= land_used
        remaining_trees -= allocated

        print(f"[TEME OPTIMIZER] Allocated {allocated} '{name}' trees "
              f"(land used: {land_used:.4f} ha, "
              f"remaining land: {remaining_land:.4f} ha, "
              f"remaining tree budget: {remaining_trees})")

        if remaining_land <= 0:
            break

    if not species_config:
        print("[TEME OPTIMIZER ERROR] Unable to allocate land to any species")
        raise ValueError("Unable to allocate land to any species")

    total_trees = sum(cfg["count"] for cfg in species_config.values())
    total_land = sum(
        cfg["count"] * cfg["land_per_tree"]
        for cfg in species_config.values()
    )
    print(f"[TEME OPTIMIZER] Final plan: {total_trees} total trees, "
          f"{total_land:.4f} ha used out of {max_land} ha available")

    return species_config
