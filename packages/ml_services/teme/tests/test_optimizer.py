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


def test_optimizer_project_goal_fastest_offset_prefers_fast_species():
    constraints = {
        "max_land_area_hectare": 1.0,
        "preferred_species": [],
        "exclude_species": [],
    }

    species_config = select_species_rule_based(
        emission_kg=1000,
        location="India_tropical",
        constraints=constraints,
        time_horizon_years=10,
        project_goal="fastest_offset",
    )

    assert len(species_config) > 0
    # Expect at least one fast-growing species in a fastest_offset portfolio.
    assert any(s in species_config for s in ["Bamboo", "Moringa", "Casuarina", "Acacia"])


def test_optimizer_supports_new_himalayan_region():
    constraints = {
        "max_land_area_hectare": 2.0,
        "preferred_species": [],
        "exclude_species": [],
    }

    species_config = select_species_rule_based(
        emission_kg=1500,
        location="India_himalayan",
        constraints=constraints,
        time_horizon_years=20,
    )

    assert len(species_config) > 0
    # Region-specific species should be viable in Himalayan plans.
    assert any(s in species_config for s in ["Chir Pine", "Sheesham", "Acacia"])


def test_optimizer_supports_new_coastal_region():
    constraints = {
        "max_land_area_hectare": 2.0,
        "preferred_species": [],
        "exclude_species": [],
    }

    species_config = select_species_rule_based(
        emission_kg=1500,
        location="India_coastal",
        constraints=constraints,
        time_horizon_years=20,
    )

    assert len(species_config) > 0
    assert any(s in species_config for s in ["Casuarina", "Pongamia", "Bamboo"])

