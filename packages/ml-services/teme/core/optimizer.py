from typing import Dict, Any
from teme.data.species_catalog import SPECIES_CATALOG


def select_species_rule_based(
    emission_kg: float,
    location: str,
    constraints: Dict[str, Any]
) -> Dict[str, Dict[str, Any]]:
    """
    Rule-based species selection for TEME.

    Returns species_config compatible with engine.run_teme
    """

    max_land = constraints["max_land_area_hectare"]
    preferred = set(constraints.get("preferred_species", []))
    excluded = set(constraints.get("exclude_species", []))

    # --- Filter viable species ---
    viable_species = {
        name: data
        for name, data in SPECIES_CATALOG.items()
        if location in data["regions"]
        and name not in excluded
    }

    if not viable_species:
        raise ValueError("No viable species for given location")

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

    # --- Allocate land greedily ---
    remaining_land = max_land
    species_config = {}

    for name, data in ranked:
        land_per_tree = data["land_per_tree"]
        if land_per_tree <= 0:
            continue

        max_trees = int(remaining_land / land_per_tree)
        if max_trees <= 0:
            continue

        species_config[name] = {
            "count": max_trees,
            "maturity_years": data["maturity_years"],
            "peak_sequestration_kg": data["peak_sequestration_kg"],
            "annual_survival_rate": data["annual_survival_rate"],
            "land_per_tree": land_per_tree
        }

        remaining_land -= max_trees * land_per_tree

        if remaining_land <= 0:
            break

    if not species_config:
        raise ValueError("Unable to allocate land to any species")

    return species_config
