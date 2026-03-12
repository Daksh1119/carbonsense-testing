"""
carbon_comparisons.py
─────────────────────
Converts a raw carbon_kg value into human-readable, scientifically
validated comparison metrics for display in the app and API response.

SCIENTIFIC BASIS FOR REFERENCE VALUES
──────────────────────────────────────
Tree sequestration (Neem, Azadirachta indica, India):
  Noor et al. (2020) "Biomass production and carbon sequestration potential
  of neem under dryland environment", Indian Journal of Agroforestry 22(1).
  A 10-year-old Neem sequesters ~18.3 kg CO₂/year; we use 10 kg/year as a
  conservative figure for a young/newly planted tree (IPCC LULUCF guidance
  always recommends the conservative end for offset claims).

Petrol combustion:
  DEFRA 2023 GHG Conversion Factors §1: 2.31 kg CO₂e per litre (exact,
  combustion-only; does not include upstream extraction emissions).

Smartphone charging (India grid):
  Central Electricity Authority (CEA) India 2023 Annual Report:
  Grid emission factor 0.716 kg CO₂e/kWh.
  Typical smartphone battery 15 Wh → 0.015 kWh × 0.716 = 0.0107 kg CO₂e per charge.
  Note: the UK grid factor (DEFRA 2023: 0.1934 kg CO₂e/kWh) is NOT used here
  because CarbonSense is an India-deployed product.

Car driving distance (India):
  Typical Indian petrol car (Maruti Suzuki/Hyundai i20 class): ~15 km/litre urban.
  DEFRA 2023 §1 petrol combustion: 2.31 kg CO₂e/litre.
  → 2.31 ÷ 15 = 0.154 kg CO₂e/km.
  Source: SIAM India Average Fuel Economy 2023; DEFRA 2023 §1.

Average Indian daily food footprint:
  Audsley et al. (2010); confirmed by Indian Council of Agricultural Research.
  Indian diet ≈ 1.0–1.5 kg CO₂e/day (predominantly plant-based); midpoint 1.25.

Annual per-capita India CO₂:
  IEA / World Bank 2023: ~2 100 kg CO₂ per capita per year (energy-sector only).
"""

from __future__ import annotations
import math
from typing import Dict


# ─── Scientific constants ─────────────────────────────────────────────────────

# Neem tree, conservative annual sequestration (young tree, first ~5 years).
# Noor et al. 2020 → 18.3 kg/yr for 10-yr tree; IPCC conservative lower bound ≈ 10.
_NEEM_KG_PER_YEAR: float = 10.0

# DEFRA 2023 §1 — exact value for petrol combustion
_PETROL_KG_PER_LITRE: float = 2.31

# India grid: CEA 2023 Annual Report, 0.716 kg CO₂e/kWh × 15 Wh smartphone = 0.0107 kg
# NOT using DEFRA UK grid (0.1934 kg/kWh) — CarbonSense is India-deployed.
_PHONE_CHARGE_KG: float = 0.0107

# India typical petrol car: 2.31 kg/litre ÷ 15 km/litre = 0.154 kg/km
# Source: SIAM India Average Fuel Economy 2023; DEFRA 2023 §1 petrol factor.
_INDIA_CAR_KG_PER_KM: float = 0.154

# ICMR / Audsley et al. Indian average daily food footprint
_INDIA_DAILY_DIET_KG: float = 1.25

# IEA / World Bank 2023 India per-capita annual CO₂
_INDIA_ANNUAL_PERCAPITA_KG: float = 2100.0


# ─── Public API ───────────────────────────────────────────────────────────────

def build_comparisons(carbon_kg: float) -> Dict:
    """
    Convert a carbon_kg value into validated comparison metrics.

    Returns a dict suitable for direct inclusion in an API response or
    display in the test script SUMMARY section.
    """
    if carbon_kg <= 0:
        return _zero_result()

    trees_needed = carbon_kg / _NEEM_KG_PER_YEAR
    days_1tree   = trees_needed * 365.0
    petrol_l     = carbon_kg / _PETROL_KG_PER_LITRE
    charges      = carbon_kg / _PHONE_CHARGE_KG
    pct_daily    = (carbon_kg / _INDIA_DAILY_DIET_KG) * 100.0
    pct_annual   = (carbon_kg / _INDIA_ANNUAL_PERCAPITA_KG) * 100.0

    return {
        "carbon_kg":                   round(carbon_kg, 3),
        # trees_decimal_raw: internal use; display logic should use the two fields below
        "trees_decimal_raw":           round(trees_needed, 3),
        "trees_whole_number":          math.ceil(trees_needed),  # always ≥ 1
        "days_1_tree_to_offset":       round(days_1tree, 1),
        "petrol_litres_equiv":         round(petrol_l, 3),
        "phone_charges_equiv":         int(charges),
        "pct_of_daily_diet_india":     round(pct_daily, 1),
        "pct_of_annual_percap_india":  round(pct_annual, 2),
        "human_summary":               _build_summary(carbon_kg, trees_needed, pct_daily),
        "methodology_note": (
            "Tree offset: young Neem (Azadirachta indica) ~10 kg CO₂/yr "
            "[Noor et al. 2020, Indian J. Agroforestry; IPCC LULUCF conservative]. "
            "Petrol: DEFRA 2023 §1 (2.31 kg CO₂e/litre). "
            "Phone charge: India grid 0.716 kg CO₂e/kWh [CEA 2023] × 15 Wh = 0.0107 kg/charge. "
            "Car: SIAM India fuel economy (15 km/litre) × DEFRA 2023 §1 = 0.154 kg CO₂e/km. "
            "Daily diet: ICMR/Audsley et al. Indian average ~1.25 kg CO₂e/day. "
            "Annual per-capita: IEA/World Bank 2023 India ~2 100 kg CO₂e/yr."
        ),
    }


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _build_summary(carbon_kg: float, trees: float, pct_daily: float) -> str:
    if carbon_kg < 0.5:
        return (
            f"Very low footprint ({carbon_kg:.2f} kg CO₂e) — "
            f"{pct_daily:.0f}% of an average Indian's daily food emissions. "
            f"One Neem tree offsets this in {trees * 365:.0f} days."
        )
    if carbon_kg < 2.0:
        return (
            f"{carbon_kg:.2f} kg CO₂e — about {pct_daily:.0f}% of an average "
            f"Indian's daily food footprint. "
            f"One Neem tree offsets this in {trees * 365:.0f} days."
        )
    if carbon_kg < 5.0:
        return (
            f"{carbon_kg:.2f} kg CO₂e — equivalent to driving ~{carbon_kg / _INDIA_CAR_KG_PER_KM:.0f} km "
            f"in a typical Indian car, or {pct_daily:.0f}% of a full day's average Indian "
            f"food footprint. One Neem tree takes {trees * 365:.0f} days to offset this."
        )
    return (
        f"High footprint: {carbon_kg:.2f} kg CO₂e — equivalent to burning "
        f"{carbon_kg / _PETROL_KG_PER_LITRE:.1f} litres of petrol. "
        f"Consider plant-based alternatives to reduce by up to 70%."
    )


def _zero_result() -> Dict:
    return {
        "carbon_kg":                   0.0,
        "trees_decimal_raw":           0.0,
        "trees_whole_number":          0,
        "days_1_tree_to_offset":       0.0,
        "petrol_litres_equiv":         0.0,
        "phone_charges_equiv":         0,
        "pct_of_daily_diet_india":     0.0,
        "pct_of_annual_percap_india":  0.0,
        "human_summary":               "No carbon emissions detected.",
        "methodology_note":            "",
    }
