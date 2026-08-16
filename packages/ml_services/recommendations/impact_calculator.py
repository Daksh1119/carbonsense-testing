"""
impact_calculator.py — Deterministic CO2 Impact Calculator
===========================================================
Calculates CO2 reduction potential from an organisation's actual KPI values
using formula-derived bounds. Every formula references its source so the
calculation chain is fully auditable.

This module replaces the LLM's guessed `estimated_impact_kg_co2e` with
numbers derived from the organisation's own data and industry-standard
reduction factors from the knowledge base.

Usage:
    from ml_services.recommendations.impact_calculator import calculate_impact

    result = calculate_impact(kb_entry, kpi_snapshots, emission_kg)
    # result = {
    #     "impact_kg_co2e": 4200.0,
    #     "impact_kg_co2e_low": 2700.0,
    #     "impact_kg_co2e_high": 5400.0,
    #     "calculation_method": "deterministic",
    #     "formula": "scope_2_kg * 0.20 * 0.45",
    #     "kpi_used": "scope_2_kg",
    #     "kpi_value": 45000.0,
    #     "source": "ENERGY STAR ...",
    # }
"""

from typing import Any, Dict, List, Optional


def _safe_float(v: Any, default: float = 0.0) -> float:
    try:
        return float(v)
    except Exception:
        return default


# ---------------------------------------------------------------------------
# KPI normalisation — map KPI snapshot names to canonical anchors
# ---------------------------------------------------------------------------

_KPI_ANCHOR_KEYWORDS: Dict[str, List[str]] = {
    "scope_2":     ["scope_2", "electricity", "power", "grid", "hvac", "lighting", "energy"],
    "scope_1":     ["scope_1", "diesel", "petrol", "gas", "furnace", "boiler", "fuel", "combustion"],
    "transport":   ["transport", "commute", "commuting", "vehicle", "fleet", "car"],
    "flight":      ["flight", "aviation", "air_travel", "business_travel"],
    "diesel":      ["diesel", "fuel_oil", "petrol", "fleet_fuel"],
    "purchases":   ["purchase", "procurement", "goods", "vendor", "supply", "scope_3"],
    "waste":       ["waste", "landfill", "compost"],
    "teme":        ["teme", "tree", "offset", "sequestration"],
}


def _resolve_kpi(anchor: str, kpi_snapshots: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    """
    Find the best-matching KPI snapshot for a given anchor string.
    Returns the KPI dict with the highest value among matches.
    """
    keywords = _KPI_ANCHOR_KEYWORDS.get(anchor, [anchor])
    matches = []
    for kpi in kpi_snapshots:
        name = str(kpi.get("kpi_name") or "").lower()
        if any(kw in name for kw in keywords):
            matches.append(kpi)

    if not matches:
        return None

    # Use the KPI with the highest value (most impactful).
    return max(matches, key=lambda k: _safe_float(k.get("kpi_value"), 0.0))


# ---------------------------------------------------------------------------
# Core calculation
# ---------------------------------------------------------------------------

def calculate_impact(
    kb_entry: Dict[str, Any],
    kpi_snapshots: List[Dict[str, Any]],
    total_emission_kg: float,
) -> Dict[str, Any]:
    """
    Calculate the CO2 reduction impact for a single knowledge base entry
    given the organisation's actual KPI snapshots.

    Priority:
    1. Use the anchor KPI from the knowledge base entry (most specific).
    2. Fall back to total_emission_kg × scope_fraction (less specific).
    3. If nothing is available, return None so the LLM value is preserved.

    Returns a dict that can be merged directly onto a recommendation record.
    """
    anchor = kb_entry.get("kpi_anchor", "scope_2")
    scope_frac_low = _safe_float(kb_entry.get("scope_fraction_low"), 0.20)
    scope_frac_high = _safe_float(kb_entry.get("scope_fraction_high"), 0.40)
    red_low = _safe_float(kb_entry.get("reduction_pct_low"), 0.10)
    red_high = _safe_float(kb_entry.get("reduction_pct_high"), 0.30)
    red_mid = (red_low + red_high) / 2.0
    scope_frac_mid = (scope_frac_low + scope_frac_high) / 2.0

    # 1. Try to use the actual KPI value.
    kpi = _resolve_kpi(anchor, kpi_snapshots)
    if kpi:
        base_value = _safe_float(kpi.get("kpi_value"), 0.0)
        kpi_name = str(kpi.get("kpi_name", anchor))
        kpi_unit = str(kpi.get("kpi_unit") or "kg CO2e")

        # The KPI value IS the applicable emission quantity for this anchor.
        # Apply the scope fraction to get the portion this strategy acts on,
        # then apply the reduction percentage.
        impact_base = base_value * scope_frac_mid * red_mid
        impact_low = base_value * scope_frac_low * red_low
        impact_high = base_value * scope_frac_high * red_high

        formula = (
            f"{kpi_name} ({round(base_value, 2)} {kpi_unit}) × "
            f"scope_fraction ({scope_frac_low:.0%}–{scope_frac_high:.0%}) × "
            f"reduction_factor ({red_low:.0%}–{red_high:.0%})"
        )
        source = kb_entry["citations"][0] if kb_entry.get("citations") else "Knowledge base"

        return {
            "impact_kg_co2e": round(max(0.0, impact_base), 2),
            "impact_kg_co2e_low": round(max(0.0, impact_low), 2),
            "impact_kg_co2e_high": round(max(0.0, impact_high), 2),
            "calculation_method": "deterministic_kpi",
            "formula": formula,
            "kpi_used": kpi_name,
            "kpi_value": base_value,
            "source": source,
        }

    # 2. Fall back to total emissions × scope fraction.
    if total_emission_kg > 0:
        impact_base = total_emission_kg * scope_frac_mid * red_mid
        impact_low = total_emission_kg * scope_frac_low * red_low
        impact_high = total_emission_kg * scope_frac_high * red_high

        formula = (
            f"total_emission_kg ({round(total_emission_kg, 2)}) × "
            f"scope_fraction ({scope_frac_low:.0%}–{scope_frac_high:.0%}) × "
            f"reduction_factor ({red_low:.0%}–{red_high:.0%})"
        )
        source = kb_entry["citations"][0] if kb_entry.get("citations") else "Knowledge base"

        return {
            "impact_kg_co2e": round(max(0.0, impact_base), 2),
            "impact_kg_co2e_low": round(max(0.0, impact_low), 2),
            "impact_kg_co2e_high": round(max(0.0, impact_high), 2),
            "calculation_method": "deterministic_total_emission",
            "formula": formula,
            "kpi_used": "total_emission_kg",
            "kpi_value": total_emission_kg,
            "source": source,
        }

    # 3. Cannot calculate — caller should preserve LLM value.
    return {
        "impact_kg_co2e": None,
        "impact_kg_co2e_low": None,
        "impact_kg_co2e_high": None,
        "calculation_method": "llm_preserved",
        "formula": "insufficient_kpi_data",
        "kpi_used": None,
        "kpi_value": None,
        "source": None,
    }


# ---------------------------------------------------------------------------
# Batch helper — match LLM recommendations to KB entries then recalculate
# ---------------------------------------------------------------------------

_TITLE_TO_KB_KEYWORDS: Dict[str, str] = {
    "led":          "energy::led_lighting_retrofit",
    "lighting":     "energy::led_lighting_retrofit",
    "hvac":         "energy::hvac_smart_controls",
    "heating":      "energy::hvac_smart_controls",
    "cooling":      "energy::hvac_smart_controls",
    "renewable":    "energy::renewable_ppa",
    "ppa":          "energy::renewable_ppa",
    "solar":        "energy::renewable_ppa",
    "wind":         "energy::renewable_ppa",
    "it ":          "energy::equipment_efficiency",
    "equipment":    "energy::equipment_efficiency",
    "server":       "energy::equipment_efficiency",
    "electric veh": "transport::ev_fleet_transition",
    "ev fleet":     "transport::ev_fleet_transition",
    "hybrid work":  "transport::hybrid_work_policy",
    "remote":       "transport::hybrid_work_policy",
    "commut":       "transport::hybrid_work_policy",
    "air travel":   "transport::business_travel_substitution",
    "flight":       "transport::business_travel_substitution",
    "business trav": "transport::business_travel_substitution",
    "freight":      "transport::route_freight_optimisation",
    "route optim":  "transport::route_freight_optimisation",
    "supplier":     "supply_chain::supplier_decarbonisation_scorecard",
    "vendor":       "supply_chain::supplier_decarbonisation_scorecard",
    "procurement":  "supply_chain::sustainable_procurement_policy",
    "purchase":     "supply_chain::sustainable_procurement_policy",
    "waste":        "waste::zero_waste_operations",
    "landfill":     "waste::zero_waste_operations",
    "packaging":    "waste::circular_packaging",
    "plastic":      "waste::circular_packaging",
    "tree":         "offset::teme_native_tree_planting",
    "forest":       "offset::teme_native_tree_planting",
    "offset":       "offset::teme_native_tree_planting",
    "carbon price": "policy::internal_carbon_price",
    "shadow price": "policy::internal_carbon_price",
    "science based": "policy::science_based_targets",
    "sbti":         "policy::science_based_targets",
}


def match_recommendation_to_kb(
    rec_title: str,
    kb_index: Dict[str, Dict[str, Any]],
) -> Optional[Dict[str, Any]]:
    """
    Given a recommendation title, attempt to find its matching KB entry.
    Returns the KB entry dict or None if no match is found.
    """
    title_lower = rec_title.lower()
    for keyword, kb_id in _TITLE_TO_KB_KEYWORDS.items():
        if keyword in title_lower:
            return kb_index.get(kb_id)
    return None


def apply_deterministic_impacts(
    recommendations: List[Dict[str, Any]],
    kpi_snapshots: List[Dict[str, Any]],
    total_emission_kg: float,
    kb_entries: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    """
    For each recommendation, attempt to match it to a KB entry and replace
    the LLM-guessed impact values with deterministic calculations.

    The LLM's original values are preserved in `recommendation_payload`
    under the key `llm_impact_estimate` for full auditability.
    """
    # Build a fast-lookup index.
    kb_index: Dict[str, Dict[str, Any]] = {e["kb_id"]: e for e in kb_entries}

    updated: List[Dict[str, Any]] = []
    for rec in recommendations:
        title = str(rec.get("title") or "")
        kb_entry = match_recommendation_to_kb(title, kb_index)

        if kb_entry is None:
            # No match: keep the LLM's values unchanged.
            updated.append(rec)
            continue

        result = calculate_impact(kb_entry, kpi_snapshots, total_emission_kg)

        if result["impact_kg_co2e"] is None:
            # Calculator couldn't produce a value — preserve LLM values.
            updated.append(rec)
            continue

        # Preserve the original LLM estimates for audit.
        payload = rec.get("recommendation_payload") or {}
        payload["llm_impact_estimate"] = {
            "estimated_impact_kg_co2e": rec.get("estimated_impact_kg_co2e"),
            "estimated_impact_kg_co2e_low": rec.get("estimated_impact_kg_co2e_low"),
            "estimated_impact_kg_co2e_high": rec.get("estimated_impact_kg_co2e_high"),
        }
        payload["deterministic_impact"] = result
        payload["kb_id"] = kb_entry["kb_id"]

        rec = {
            **rec,
            "estimated_impact_kg_co2e": result["impact_kg_co2e"],
            "estimated_impact_kg_co2e_low": result["impact_kg_co2e_low"],
            "estimated_impact_kg_co2e_high": result["impact_kg_co2e_high"],
            "recommendation_payload": payload,
        }
        updated.append(rec)

    return updated
