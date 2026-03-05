from typing import Dict


def calculate_land_required(
    species_counts: Dict[str, int],
    land_per_tree: Dict[str, float]
) -> float:
    """
    Calculate total land required in hectares.

    species_counts:
        {species: number_of_trees}

    land_per_tree:
        {species: hectares_per_tree}
    """
    total_land = 0.0

    for species, count in species_counts.items():
        if species not in land_per_tree:
            raise ValueError(f"Missing land data for species: {species}")

        if count < 0:
            raise ValueError("Tree count cannot be negative")

        total_land += count * land_per_tree[species]

    return total_land
