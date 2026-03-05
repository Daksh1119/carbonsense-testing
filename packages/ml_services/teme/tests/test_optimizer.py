from ml_services.teme.core.optimizer import select_species_rule_based


def test_optimizer_returns_species():
    constraints = {
        "max_land_area_hectare": 1.0,
        "preferred_species": ["Neem"],
        "exclude_species": []
    }

    species_config = select_species_rule_based(
        emission_kg=1000,
        location="India",
        constraints=constraints
    )

    assert len(species_config) > 0
    assert "Neem" in species_config

