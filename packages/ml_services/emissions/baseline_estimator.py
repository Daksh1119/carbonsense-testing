"""
baseline_estimator.py
=====================
Deterministic baseline carbon footprint estimator for CarbonSense.

Takes an organization's profile fields (from 1.1/1.2 migration) and returns:
  - total_emissions_tco2e: float
  - category_breakdown: dict  {category: tco2e, ...}

No ML, no LLM — pure emission-factor arithmetic following the same pattern
as the existing csv_engine.py / calculator.py.

Emission factors used
---------------------
Grid electricity  : India CEA average 0.716 kg CO₂e / kWh (CEA 2022-23 CO2 Baseline)
Renewable offset  : Reduced by renewable_energy_pct / 100 (additive linear model)
IT devices        : 0.065 kW average per device × 8h/day × working_days_per_year → kWh → CO₂e
HVAC (facility)   : sector-dependent W/sqft multiplier × 8h × days → kWh → CO₂e
Petrol fleet      : 0.192 kg CO₂e / vehicle-km (avg car, GHG Protocol 2024 India)
Business travel   : 0.255 kg CO₂e / person-km (domestic aviation avg, DEFRA 2023)
Waste             : 0.587 kg CO₂e / kg waste (mixed waste, landfill, IPCC Tier 1)
Water             : 0.344 kg CO₂e / kL (pumping + treatment, India avg)

All outputs are in tCO₂e (metric tonnes of CO₂ equivalent).
"""

from __future__ import annotations

from typing import Any, Dict, Optional

# ---------------------------------------------------------------------------
# Emission factors (kg CO₂e per unit)
# ---------------------------------------------------------------------------

# India CEA 2022-23 grid emission factor (CO₂ only; marginal factor)
_GRID_EF_KG_PER_KWH: float = 0.716

# Average PC/laptop power draw assumed for SME context
_DEVICE_POWER_KW: float = 0.065          # kW per device
_DEVICE_DAILY_HOURS: float = 8.0

# HVAC load per sqft by sector (W / sqft average during occupied hours)
_HVAC_W_PER_SQFT: Dict[str, float] = {
    "Manufacturing":  1.5,
    "IT/ITES":        2.5,
    "Textiles":       1.2,
    "F&B":            3.0,
    "Retail":         3.5,
    "Logistics":      0.8,
    "Construction":   1.0,
    "Healthcare":     4.0,
    "Other":          2.0,
}
_DEFAULT_HVAC_W_PER_SQFT: float = 2.0

# Transport / travel
_FLEET_KM_PER_VEHICLE_ANNUAL: float = 18000.0   # assumed 50 km/day × 360 days if not provided
_FLEET_CO2_KG_PER_KM: float = 0.192            # avg petrol car (GHG Protocol India)
_TRAVEL_CO2_KG_PER_KM: float = 0.255           # domestic aviation avg (DEFRA 2023)

# Waste & water (Scope 3 proxies)
_WASTE_CO2_KG_PER_KG: float = 0.587            # mixed waste landfill (IPCC Tier 1)
_WATER_CO2_KG_PER_KL: float = 0.344            # pumping + treatment (India avg)

# Sector-average monthly electricity (kWh/employee) — fallback when no kWh provided
_SECTOR_KWH_PER_EMPLOYEE_MONTHLY: Dict[str, float] = {
    "Manufacturing":  400.0,
    "IT/ITES":        120.0,
    "Textiles":       350.0,
    "F&B":            250.0,
    "Retail":         200.0,
    "Logistics":      80.0,
    "Construction":   60.0,
    "Healthcare":     300.0,
    "Other":          150.0,
}
_DEFAULT_KWH_PER_EMPLOYEE_MONTHLY: float = 150.0


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _safe(v: Any, default: float = 0.0) -> float:
    """Safely coerce to float, returning default on None / falsy."""
    if v is None:
        return default
    try:
        f = float(v)
        return f if f >= 0 else default
    except (TypeError, ValueError):
        return default


def _working_days_annual(working_days_per_week: Optional[int]) -> float:
    """Convert working days/week to annual working days. Default 5d/week."""
    wdpw = _safe(working_days_per_week, 5.0)
    wdpw = max(1.0, min(wdpw, 7.0))
    return wdpw * 52.0


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def estimate_baseline(org_profile: Dict[str, Any]) -> Dict[str, Any]:
    """
    Compute a deterministic baseline carbon footprint from org profile fields.

    Parameters
    ----------
    org_profile : dict
        Row from the `organizations` table (after 1.1/1.2 migration).

    Returns
    -------
    dict with keys:
        total_emissions_tco2e : float
        category_breakdown    : dict[str, float]  (kg CO₂e per category)
        confidence_level      : str  ('rough_estimate' | 'estimated' | 'detailed')
        notes                 : list[str]
    """

    notes: list[str] = []
    breakdown: Dict[str, float] = {
        "Energy":    0.0,
        "Transport": 0.0,
        "Waste":     0.0,
        "Water":     0.0,
    }

    sector: str = (org_profile.get("sector") or "Other").strip()
    renewable_pct: float = min(100.0, max(0.0, _safe(org_profile.get("renewable_energy_pct"), 0.0)))
    grid_ef: float = _GRID_EF_KG_PER_KWH * (1.0 - renewable_pct / 100.0)

    employee_count: float = _safe(org_profile.get("employee_count"), 0.0)
    working_days: float = _working_days_annual(org_profile.get("working_days_per_week"))

    # ── Energy: grid electricity ────────────────────────────────────────────
    kwh_monthly: float = _safe(org_profile.get("electricity_usage_kwh_monthly"), 0.0)
    if kwh_monthly > 0:
        elec_kwh_annual = kwh_monthly * 12.0
        notes.append("Electricity usage based on provided monthly kWh.")
    elif employee_count > 0:
        sector_kwh = _SECTOR_KWH_PER_EMPLOYEE_MONTHLY.get(sector, _DEFAULT_KWH_PER_EMPLOYEE_MONTHLY)
        elec_kwh_annual = employee_count * sector_kwh * 12.0
        notes.append(
            f"Electricity usage estimated from {int(employee_count)} employees × "
            f"{sector_kwh} kWh/employee/month (sector average for {sector})."
        )
    else:
        elec_kwh_annual = 0.0
        notes.append("No electricity or employee data — electricity estimate is zero.")

    breakdown["Energy"] += elec_kwh_annual * grid_ef

    # ── Energy: IT devices ──────────────────────────────────────────────────
    computers_count: float = _safe(org_profile.get("computers_count"), 0.0)
    if computers_count > 0:
        device_kwh = computers_count * _DEVICE_POWER_KW * _DEVICE_DAILY_HOURS * working_days
        breakdown["Energy"] += device_kwh * grid_ef
        notes.append(f"Device energy estimated for {int(computers_count)} computers.")

    # ── Energy: HVAC from facility area ────────────────────────────────────
    facility_sqft: float = _safe(org_profile.get("facility_area_sqft"), 0.0)
    if facility_sqft > 0:
        hvac_w_sqft = _HVAC_W_PER_SQFT.get(sector, _DEFAULT_HVAC_W_PER_SQFT)
        hvac_kwh = (facility_sqft * hvac_w_sqft / 1000.0) * _DEVICE_DAILY_HOURS * working_days
        breakdown["Energy"] += hvac_kwh * grid_ef
        notes.append(
            f"HVAC load estimated from {int(facility_sqft)} sqft facility "
            f"({hvac_w_sqft} W/sqft for {sector})."
        )

    # ── Transport: fleet ────────────────────────────────────────────────────
    fleet_count: float = _safe(org_profile.get("vehicle_fleet_count"), 0.0)
    if fleet_count > 0:
        fleet_km = fleet_count * _FLEET_KM_PER_VEHICLE_ANNUAL
        breakdown["Transport"] += fleet_km * _FLEET_CO2_KG_PER_KM
        notes.append(
            f"Fleet transport estimated for {int(fleet_count)} vehicles × "
            f"{int(_FLEET_KM_PER_VEHICLE_ANNUAL):,} km/year (assumed)."
        )

    # ── Transport: business travel ──────────────────────────────────────────
    travel_km: float = _safe(org_profile.get("business_travel_km_annual"), 0.0)
    if travel_km > 0:
        breakdown["Transport"] += travel_km * _TRAVEL_CO2_KG_PER_KM
        notes.append(f"Business travel: {int(travel_km):,} km/year.")

    # ── Waste ───────────────────────────────────────────────────────────────
    waste_kg_monthly: float = _safe(org_profile.get("waste_generated_kg_monthly"), 0.0)
    if waste_kg_monthly > 0:
        waste_kg_annual = waste_kg_monthly * 12.0
        breakdown["Waste"] += waste_kg_annual * _WASTE_CO2_KG_PER_KG
        notes.append(f"Waste: {int(waste_kg_monthly)} kg/month → landfill emission factor applied.")

    # ── Water ───────────────────────────────────────────────────────────────
    water_kl_monthly: float = _safe(org_profile.get("water_usage_kl_monthly"), 0.0)
    if water_kl_monthly > 0:
        water_kl_annual = water_kl_monthly * 12.0
        breakdown["Water"] += water_kl_annual * _WATER_CO2_KG_PER_KL
        notes.append(f"Water: {int(water_kl_monthly)} kL/month.")

    # ── Confidence level ───────────────────────────────────────────────────
    filled_count = sum([
        kwh_monthly > 0,
        computers_count > 0,
        facility_sqft > 0,
        fleet_count > 0,
        travel_km > 0,
        waste_kg_monthly > 0,
        water_kl_monthly > 0,
    ])
    if filled_count == 0:
        confidence = "rough_estimate"
        notes.insert(0,
            "⚠ No optional fields provided. Footprint is a rough industry-average estimate only. "
            "Fill in your profile for a more accurate baseline."
        )
    elif filled_count <= 3:
        confidence = "estimated"
        notes.insert(0, "Baseline based on partial profile data. Add more fields for a better estimate.")
    else:
        confidence = "detailed"

    # Convert breakdown from kg to tCO₂e
    breakdown_tco2e = {k: round(v / 1000.0, 4) for k, v in breakdown.items()}
    total_tco2e = round(sum(breakdown_tco2e.values()), 4)

    return {
        "total_emissions_tco2e": total_tco2e,
        "category_breakdown": breakdown_tco2e,
        "confidence_level": confidence,
        "notes": notes,
    }
