from ml_services.teme.core.engine import run_teme
from ml_services.teme.core.exceptions import InfeasiblePlanError

payload = {
    "emission_kg": 2000,
    "location": "India",
    "start_year": 2026,
    "time_horizon_years": 15,
    "constraints": {
        "max_land_area_hectare": 0.1
    }
}

try:
    result = run_teme(payload)
    print("TEME RESULT:")
    print(result)
except InfeasiblePlanError as e:
    print("TEME ERROR (Expected for this scenario):")
    print(str(e))

