from typing import Dict, Any
from ml_services.teme.data.species_catalog import SPECIES_CATALOG


def select_species_rule_based(
    emission_kg: float,
    location: str,
    constraints: Dict[str, Any]
) -> Dict[str, Dict[str, Any]]:
    """
    Rule-based species selection for TEME.

    Selects viable species based on location, ranks by priority,
    and allocates trees proportional to emission target â€” NOT just
    by filling all available land.

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
            base += 0.1
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
    avg_annual_per_tree = top_species["peak_sequestration_kg"] * 0.5

    if avg_annual_per_tree > 0:
        estimated_trees_needed = int(
            (emission_kg / (avg_annual_per_tree * 10)) * 1.5
        )
        estimated_trees_needed = max(estimated_trees_needed, 10)
    else:
        estimated_trees_needed = 10000

    print(f"[TEME OPTIMIZER] Emission target: {emission_kg} kg CO2")
    print(f"[TEME OPTIMIZER] Avg annual per tree (est): {avg_annual_per_tree} kg")
    print(f"[TEME OPTIMIZER] Estimated trees needed (1.5x margin): "
          f"{estimated_trees_needed}")

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

        allocated = min(max_trees_by_land, remaining_trees)

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
