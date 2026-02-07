import pytest
from teme.core.engine import run_teme
from teme.core.exceptions import InfeasiblePlanError


def test_land_constraint_violation():
    payload = {
        "emission_kg": 1000,
        "time_horizon_years": 20,
        "constraints": {
            "max_land_area_hectare": 0.1
        },
        "species_config": {
            "Neem": {
                "count": 100,
                "maturity_years": 5,
                "peak_sequestration_kg": 20,
                "annual_survival_rate": 0.95,
                "land_per_tree": 0.01
            }
        }
    }

    with pytest.raises(InfeasiblePlanError):
        run_teme(payload)
