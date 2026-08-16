"""
knowledge_base.py — Curated Industry Strategy Knowledge Base
=============================================================
Every entry in this catalog is backed by at least one peer-reviewed or
officially-published source. The LLM is given these entries as verified
evidence items so it cannot fabricate citations.

Primary sources used:
  - GHG Protocol Corporate Standard v2 (2015)
  - IEA Energy Efficiency 2023 (International Energy Agency)
  - ENERGY STAR Portfolio Manager Technical Reference, 2023
  - ASHRAE Standard 90.1-2022
  - EPA SmartWay Program Carrier Data, 2023
  - DEFRA UK GHG Reporting Conversion Factors, 2023
  - CDP Supply Chain Report 2023
  - IPCC AR6 Working Group III, Chapter 6 (Buildings) & Chapter 10 (Transport)
  - World Resources Institute CAIT Database
  - Carbon Trust Route Map methodology guides
"""

from typing import Any, Dict, List, Optional

# ---------------------------------------------------------------------------
# Schema for a knowledge base entry:
#   kb_id                  : unique identifier
#   strategy_type          : category for matching (energy_efficiency | transport |
#                            supply_chain | waste | offset | policy)
#   ghg_scope              : scope_1 | scope_2 | scope_3 | mixed
#   action_type            : reduction | offset | policy | compliance
#   title                  : short strategy name
#   description            : 1-2 sentence explanation
#   kpi_anchor             : the KPI name fragment this strategy applies to
#   scope_fraction_low     : fraction of that KPI this action typically affects (low estimate)
#   scope_fraction_high    : fraction of that KPI this action typically affects (high estimate)
#   reduction_pct_low      : % CO2 reduction within that fraction (low estimate)
#   reduction_pct_high     : % CO2 reduction within that fraction (high estimate)
#   payback_years_low      : financial payback period low
#   payback_years_high     : financial payback period high
#   cost_usd_per_employee_low  : indicative CAPEX/OPEX low (USD / employee, or None)
#   cost_usd_per_employee_high : indicative CAPEX/OPEX high (USD / employee, or None)
#   time_to_impact_months_low  : months before measurable impact begins
#   time_to_impact_months_high : months before measurable impact begins (high)
#   confidence             : 0–1, reflecting source quality and consensus
#   industry_tags          : list of sector strings where applicable
#   citations              : list of citation strings
# ---------------------------------------------------------------------------

KNOWLEDGE_BASE: List[Dict[str, Any]] = [

    # -------------------------------------------------------------------------
    # SCOPE 2 — ENERGY EFFICIENCY
    # -------------------------------------------------------------------------
    {
        "kb_id": "energy::led_lighting_retrofit",
        "strategy_type": "energy_efficiency",
        "ghg_scope": "scope_2",
        "action_type": "reduction",
        "title": "LED Lighting Retrofit with Occupancy Sensors",
        "description": (
            "Replace fluorescent and incandescent lighting with high-efficiency LED fixtures "
            "combined with occupancy sensors and daylight harvesting controls."
        ),
        "kpi_anchor": "scope_2",
        "scope_fraction_low": 0.15,
        "scope_fraction_high": 0.30,
        "reduction_pct_low": 0.30,
        "reduction_pct_high": 0.60,
        "payback_years_low": 2.0,
        "payback_years_high": 5.0,
        "cost_usd_per_employee_low": 120,
        "cost_usd_per_employee_high": 380,
        "time_to_impact_months_low": 2,
        "time_to_impact_months_high": 6,
        "confidence": 0.92,
        "industry_tags": ["general", "office", "manufacturing", "retail", "hospitality"],
        "citations": [
            "ENERGY STAR Portfolio Manager Technical Reference: Lighting, 2023",
            "ASHRAE Standard 90.1-2022, Section 9: Lighting Power Density",
            "IEA Energy Efficiency 2023, Chapter 3: Buildings — Lighting",
            "Carbon Trust Guide: Saving energy with lighting, CTV019",
        ],
    },
    {
        "kb_id": "energy::hvac_smart_controls",
        "strategy_type": "energy_efficiency",
        "ghg_scope": "scope_2",
        "action_type": "reduction",
        "title": "Smart HVAC Controls and Building Automation",
        "description": (
            "Deploy programmable thermostats, variable-frequency drives on HVAC motors, "
            "and building management systems to optimize heating/cooling schedules."
        ),
        "kpi_anchor": "scope_2",
        "scope_fraction_low": 0.30,
        "scope_fraction_high": 0.50,
        "reduction_pct_low": 0.15,
        "reduction_pct_high": 0.35,
        "payback_years_low": 2.5,
        "payback_years_high": 6.0,
        "cost_usd_per_employee_low": 200,
        "cost_usd_per_employee_high": 800,
        "time_to_impact_months_low": 3,
        "time_to_impact_months_high": 9,
        "confidence": 0.89,
        "industry_tags": ["general", "office", "manufacturing", "hospitality", "healthcare"],
        "citations": [
            "ENERGY STAR Building Upgrade Manual, Chapter 3: HVAC, 2023",
            "ASHRAE 90.1-2022, Section 6: Heating, Ventilating and Air Conditioning",
            "IEA Energy Efficiency 2023, Chapter 3: Buildings — HVAC",
            "GHG Protocol Corporate Standard, Chapter 4: Scope 2 Accounting",
        ],
    },
    {
        "kb_id": "energy::renewable_ppa",
        "strategy_type": "energy_efficiency",
        "ghg_scope": "scope_2",
        "action_type": "reduction",
        "title": "Renewable Energy Procurement (PPA or Green Tariff)",
        "description": (
            "Switch to 100% renewable electricity via a Power Purchase Agreement (PPA) "
            "or green tariff with market-based Scope 2 accounting under GHG Protocol."
        ),
        "kpi_anchor": "scope_2",
        "scope_fraction_low": 0.80,
        "scope_fraction_high": 1.00,
        "reduction_pct_low": 0.70,
        "reduction_pct_high": 1.00,
        "payback_years_low": 0.0,
        "payback_years_high": 3.0,
        "cost_usd_per_employee_low": 50,
        "cost_usd_per_employee_high": 200,
        "time_to_impact_months_low": 3,
        "time_to_impact_months_high": 18,
        "confidence": 0.90,
        "industry_tags": ["general", "office", "manufacturing", "technology", "retail"],
        "citations": [
            "GHG Protocol Scope 2 Guidance, 2015 — Market-Based Method",
            "RE100 Technical Criteria, 2023 Edition",
            "IEA Renewables 2023: Power Purchase Agreements",
            "DEFRA GHG Reporting: Market-based Scope 2 Factors, 2023",
        ],
    },
    {
        "kb_id": "energy::equipment_efficiency",
        "strategy_type": "energy_efficiency",
        "ghg_scope": "scope_2",
        "action_type": "reduction",
        "title": "IT and Office Equipment Power Management",
        "description": (
            "Enable aggressive power management settings on computers, servers, and "
            "peripheral equipment; replace end-of-life units with ENERGY STAR certified models."
        ),
        "kpi_anchor": "scope_2",
        "scope_fraction_low": 0.10,
        "scope_fraction_high": 0.20,
        "reduction_pct_low": 0.20,
        "reduction_pct_high": 0.45,
        "payback_years_low": 1.0,
        "payback_years_high": 3.5,
        "cost_usd_per_employee_low": 30,
        "cost_usd_per_employee_high": 150,
        "time_to_impact_months_low": 1,
        "time_to_impact_months_high": 4,
        "confidence": 0.85,
        "industry_tags": ["general", "office", "technology", "financial_services"],
        "citations": [
            "ENERGY STAR Computers and Monitors Specification v8.0, 2023",
            "Carbon Trust: Saving energy in offices, CTL136",
            "IEA Energy Efficiency 2023, Chapter 3: Appliances and Equipment",
        ],
    },

    # -------------------------------------------------------------------------
    # SCOPE 1 — TRANSPORT & FLEET
    # -------------------------------------------------------------------------
    {
        "kb_id": "transport::ev_fleet_transition",
        "strategy_type": "transport",
        "ghg_scope": "scope_1",
        "action_type": "reduction",
        "title": "Electric Vehicle (EV) Fleet Transition",
        "description": (
            "Replace internal combustion engine company vehicles with battery-electric "
            "equivalents, starting with highest-mileage assets in the fleet."
        ),
        "kpi_anchor": "transport",
        "scope_fraction_low": 0.60,
        "scope_fraction_high": 0.90,
        "reduction_pct_low": 0.55,
        "reduction_pct_high": 0.85,
        "payback_years_low": 3.0,
        "payback_years_high": 8.0,
        "cost_usd_per_employee_low": 500,
        "cost_usd_per_employee_high": 3000,
        "time_to_impact_months_low": 6,
        "time_to_impact_months_high": 24,
        "confidence": 0.85,
        "industry_tags": ["logistics", "transport", "manufacturing", "general"],
        "citations": [
            "IPCC AR6 WG3, Chapter 10: Transport — EV emissions lifecycle",
            "EPA SmartWay Program: Fleet Electrification Guide, 2023",
            "IEA Global EV Outlook 2023: Emission Reductions",
            "DEFRA Vehicle Emission Conversion Factors, 2023",
        ],
    },
    {
        "kb_id": "transport::hybrid_work_policy",
        "strategy_type": "transport",
        "ghg_scope": "scope_3",
        "action_type": "reduction",
        "title": "Hybrid Work and Commute Reduction Policy",
        "description": (
            "Formalise a 2-3 day per week hybrid work policy to reduce employee commuting "
            "emissions, complemented by public transport subsidies and cycle-to-work schemes."
        ),
        "kpi_anchor": "transport",
        "scope_fraction_low": 0.25,
        "scope_fraction_high": 0.45,
        "reduction_pct_low": 0.30,
        "reduction_pct_high": 0.50,
        "payback_years_low": 0.0,
        "payback_years_high": 1.0,
        "cost_usd_per_employee_low": 20,
        "cost_usd_per_employee_high": 100,
        "time_to_impact_months_low": 2,
        "time_to_impact_months_high": 6,
        "confidence": 0.82,
        "industry_tags": ["general", "office", "technology", "financial_services"],
        "citations": [
            "CDP Climate Change 2023: Employee Commuting Category 7",
            "GHG Protocol Corporate Standard: Category 7 Employee Commuting",
            "IPCC AR6 WG3, Chapter 10: Transport demand reduction measures",
        ],
    },
    {
        "kb_id": "transport::business_travel_substitution",
        "strategy_type": "transport",
        "ghg_scope": "scope_3",
        "action_type": "reduction",
        "title": "Business Air Travel Substitution with Virtual Meetings",
        "description": (
            "Mandate virtual meetings for all trips under 500 km and require pre-approval "
            "for long-haul flights; prioritise rail for sub-3-hour journeys."
        ),
        "kpi_anchor": "flight",
        "scope_fraction_low": 0.40,
        "scope_fraction_high": 0.70,
        "reduction_pct_low": 0.25,
        "reduction_pct_high": 0.55,
        "payback_years_low": 0.0,
        "payback_years_high": 0.5,
        "cost_usd_per_employee_low": 0,
        "cost_usd_per_employee_high": 50,
        "time_to_impact_months_low": 1,
        "time_to_impact_months_high": 4,
        "confidence": 0.84,
        "industry_tags": ["general", "office", "financial_services", "consulting"],
        "citations": [
            "DEFRA GHG Reporting Factors: Business Travel — Aviation, 2023",
            "CDP Supply Chain 2023: Category 6 Business Travel",
            "GHG Protocol Category 6: Business Travel Calculation Guidance",
        ],
    },
    {
        "kb_id": "transport::route_freight_optimisation",
        "strategy_type": "transport",
        "ghg_scope": "scope_1",
        "action_type": "reduction",
        "title": "Freight Route Optimisation and Load Consolidation",
        "description": (
            "Deploy route optimisation software and load consolidation strategies to reduce "
            "empty miles and improve vehicle utilisation across the logistics fleet."
        ),
        "kpi_anchor": "diesel",
        "scope_fraction_low": 0.50,
        "scope_fraction_high": 0.80,
        "reduction_pct_low": 0.10,
        "reduction_pct_high": 0.25,
        "payback_years_low": 1.0,
        "payback_years_high": 3.0,
        "cost_usd_per_employee_low": 100,
        "cost_usd_per_employee_high": 400,
        "time_to_impact_months_low": 3,
        "time_to_impact_months_high": 9,
        "confidence": 0.80,
        "industry_tags": ["logistics", "transport", "manufacturing", "retail"],
        "citations": [
            "EPA SmartWay Carrier Efficiency Strategies Guide, 2023",
            "IEA Transport Energy and CO2: Moving toward Sustainability, 2009 (updated 2023)",
            "GHG Protocol Category 4: Upstream Transportation",
        ],
    },

    # -------------------------------------------------------------------------
    # SCOPE 3 — SUPPLY CHAIN & PROCUREMENT
    # -------------------------------------------------------------------------
    {
        "kb_id": "supply_chain::supplier_decarbonisation_scorecard",
        "strategy_type": "supply_chain",
        "ghg_scope": "scope_3",
        "action_type": "policy",
        "title": "Supplier Decarbonisation Scorecard and Engagement Programme",
        "description": (
            "Implement a supplier sustainability scorecard requiring top-50 suppliers "
            "to disclose Scope 1 and 2 emissions via CDP or equivalent, with preferred-vendor "
            "status tied to reduction targets."
        ),
        "kpi_anchor": "purchases",
        "scope_fraction_low": 0.30,
        "scope_fraction_high": 0.60,
        "reduction_pct_low": 0.08,
        "reduction_pct_high": 0.20,
        "payback_years_low": 3.0,
        "payback_years_high": 7.0,
        "cost_usd_per_employee_low": 80,
        "cost_usd_per_employee_high": 300,
        "time_to_impact_months_low": 6,
        "time_to_impact_months_high": 18,
        "confidence": 0.78,
        "industry_tags": ["manufacturing", "retail", "general", "food_beverage"],
        "citations": [
            "CDP Supply Chain Report 2023: Supplier Engagement",
            "GHG Protocol Corporate Standard: Category 1 Purchased Goods & Services",
            "Science Based Targets initiative (SBTi): Supplier Engagement Guidance",
            "IPCC AR6 WG3, Chapter 5: Demand-side solutions",
        ],
    },
    {
        "kb_id": "supply_chain::sustainable_procurement_policy",
        "strategy_type": "supply_chain",
        "ghg_scope": "scope_3",
        "action_type": "policy",
        "title": "Sustainable Procurement Policy with Low-Carbon Criteria",
        "description": (
            "Embed CO2 intensity thresholds and circular economy criteria into procurement "
            "contracts and tender evaluation for all new vendor engagements."
        ),
        "kpi_anchor": "procurement",
        "scope_fraction_low": 0.20,
        "scope_fraction_high": 0.50,
        "reduction_pct_low": 0.05,
        "reduction_pct_high": 0.18,
        "payback_years_low": 2.0,
        "payback_years_high": 5.0,
        "cost_usd_per_employee_low": 40,
        "cost_usd_per_employee_high": 150,
        "time_to_impact_months_low": 6,
        "time_to_impact_months_high": 24,
        "confidence": 0.74,
        "industry_tags": ["general", "government", "financial_services", "retail"],
        "citations": [
            "GHG Protocol Scope 3 Standard: Category 1 Calculation Methods",
            "CDP Supply Chain 2023: Embedding sustainability in procurement",
            "DEFRA PPN 06/21: Taking account of Carbon Reduction Plans",
        ],
    },

    # -------------------------------------------------------------------------
    # WASTE & OPERATIONS
    # -------------------------------------------------------------------------
    {
        "kb_id": "waste::zero_waste_operations",
        "strategy_type": "waste",
        "ghg_scope": "scope_3",
        "action_type": "reduction",
        "title": "Waste Diversion and Zero-to-Landfill Programme",
        "description": (
            "Implement source-separation recycling, composting of organic waste, and "
            "audit-driven waste reduction to divert >90% of operational waste from landfill."
        ),
        "kpi_anchor": "waste",
        "scope_fraction_low": 0.60,
        "scope_fraction_high": 0.90,
        "reduction_pct_low": 0.30,
        "reduction_pct_high": 0.65,
        "payback_years_low": 1.0,
        "payback_years_high": 4.0,
        "cost_usd_per_employee_low": 30,
        "cost_usd_per_employee_high": 120,
        "time_to_impact_months_low": 3,
        "time_to_impact_months_high": 12,
        "confidence": 0.80,
        "industry_tags": ["manufacturing", "food_beverage", "hospitality", "retail", "general"],
        "citations": [
            "GHG Protocol Category 5: Waste Generated in Operations",
            "DEFRA UK Waste Conversion Factors, 2023",
            "IPCC AR6 WG3, Chapter 7: Agriculture, Forestry and Other Land Use — waste methane",
            "EPA WARM Model: Waste Reduction Model v15, 2023",
        ],
    },
    {
        "kb_id": "waste::circular_packaging",
        "strategy_type": "waste",
        "ghg_scope": "scope_3",
        "action_type": "reduction",
        "title": "Circular Packaging and Single-Use Plastic Elimination",
        "description": (
            "Transition to recycled-content or reusable packaging materials, eliminating "
            "single-use plastics to reduce upstream embodied carbon in packaging."
        ),
        "kpi_anchor": "purchases",
        "scope_fraction_low": 0.05,
        "scope_fraction_high": 0.15,
        "reduction_pct_low": 0.20,
        "reduction_pct_high": 0.50,
        "payback_years_low": 2.0,
        "payback_years_high": 5.0,
        "cost_usd_per_employee_low": 20,
        "cost_usd_per_employee_high": 100,
        "time_to_impact_months_low": 6,
        "time_to_impact_months_high": 18,
        "confidence": 0.72,
        "industry_tags": ["retail", "food_beverage", "manufacturing", "hospitality"],
        "citations": [
            "GHG Protocol Scope 3: Category 1 Purchased Goods",
            "CDP Supply Chain 2023: Packaging and material circularity",
            "Ellen MacArthur Foundation: The New Plastics Economy, 2016 (updated 2022)",
        ],
    },

    # -------------------------------------------------------------------------
    # NATURE-BASED OFFSETS (last resort, secondary to reductions)
    # -------------------------------------------------------------------------
    {
        "kb_id": "offset::teme_native_tree_planting",
        "strategy_type": "offset",
        "ghg_scope": "scope_1",
        "action_type": "offset",
        "title": "Native Species Afforestation (TEME-Validated)",
        "description": (
            "Execute a science-backed native species tree planting programme using "
            "the CarbonSense TEME survival model, targeting residual emissions after "
            "all direct reduction measures are in place."
        ),
        "kpi_anchor": "teme",
        "scope_fraction_low": 1.0,
        "scope_fraction_high": 1.0,
        "reduction_pct_low": 0.10,
        "reduction_pct_high": 0.25,
        "payback_years_low": 8.0,
        "payback_years_high": 20.0,
        "cost_usd_per_employee_low": 200,
        "cost_usd_per_employee_high": 800,
        "time_to_impact_months_low": 12,
        "time_to_impact_months_high": 36,
        "confidence": 0.70,
        "industry_tags": ["general"],
        "citations": [
            "IPCC AR6 WG3, Chapter 7: AFOLU — Land-based mitigation options",
            "Verra Verified Carbon Standard (VCS) Methodology VM0010",
            "Gold Standard for the Global Goals: Afforestation/Reforestation",
            "CarbonSense TEME V4 Model: Survival-adjusted sequestration estimates",
        ],
    },

    # -------------------------------------------------------------------------
    # POLICY & COMPLIANCE
    # -------------------------------------------------------------------------
    {
        "kb_id": "policy::internal_carbon_price",
        "strategy_type": "policy",
        "ghg_scope": "mixed",
        "action_type": "policy",
        "title": "Internal Carbon Pricing (Shadow Carbon Price)",
        "description": (
            "Apply an internal shadow price on CO2 (USD 50–150/tCO2e) to all capital "
            "expenditure decisions, making high-carbon projects economically unfeasible "
            "compared to low-carbon alternatives."
        ),
        "kpi_anchor": "scope_2",
        "scope_fraction_low": 0.50,
        "scope_fraction_high": 1.00,
        "reduction_pct_low": 0.05,
        "reduction_pct_high": 0.20,
        "payback_years_low": 0.0,
        "payback_years_high": 2.0,
        "cost_usd_per_employee_low": 10,
        "cost_usd_per_employee_high": 60,
        "time_to_impact_months_low": 3,
        "time_to_impact_months_high": 12,
        "confidence": 0.75,
        "industry_tags": ["general", "manufacturing", "financial_services"],
        "citations": [
            "World Bank Carbon Pricing Leadership Coalition: Internal Carbon Pricing Guidance",
            "GHG Protocol Corporate Standard: Governance and target-setting",
            "CDP Climate Change 2023: Internal carbon pricing survey results",
            "TCFD Recommendations: Transition risk and internal carbon pricing, 2021",
        ],
    },
    {
        "kb_id": "policy::science_based_targets",
        "strategy_type": "policy",
        "ghg_scope": "mixed",
        "action_type": "compliance",
        "title": "Science Based Targets (SBTi) Commitment and Pathway",
        "description": (
            "Commit to the Science Based Targets initiative (SBTi) Corporate Standard, "
            "setting 1.5°C-aligned near-term Scope 1, 2, and material Scope 3 targets "
            "validated by independent experts."
        ),
        "kpi_anchor": "scope_2",
        "scope_fraction_low": 0.80,
        "scope_fraction_high": 1.00,
        "reduction_pct_low": 0.30,
        "reduction_pct_high": 0.50,
        "payback_years_low": 0.0,
        "payback_years_high": 1.0,
        "cost_usd_per_employee_low": 15,
        "cost_usd_per_employee_high": 80,
        "time_to_impact_months_low": 6,
        "time_to_impact_months_high": 24,
        "confidence": 0.88,
        "industry_tags": ["general"],
        "citations": [
            "SBTi Corporate Standard v2.0, 2023",
            "IPCC SR1.5: 1.5°C scenario emission pathways",
            "GHG Protocol Corporate Standard: Target-setting guidance",
        ],
    },
]


# ---------------------------------------------------------------------------
# Lookup helpers
# ---------------------------------------------------------------------------

def get_all_entries() -> List[Dict[str, Any]]:
    """Return all knowledge base entries."""
    return KNOWLEDGE_BASE


def get_entries_by_strategy_type(strategy_type: str) -> List[Dict[str, Any]]:
    """Return all entries matching a given strategy_type."""
    return [e for e in KNOWLEDGE_BASE if e["strategy_type"] == strategy_type]


def find_entries_for_focus_areas(focus_areas: List[str]) -> List[Dict[str, Any]]:
    """
    Given a list of focus area strings (e.g. ['scope_2_energy', 'transport']),
    return the most relevant KB entries.  Matching is done via kpi_anchor and
    strategy_type keywords so no vector DB is required.
    """
    area_to_strategy = {
        "scope_2_energy": ["energy_efficiency"],
        "transport":      ["transport"],
        "purchases":      ["supply_chain"],
        "operations":     ["waste"],
        "offset":         ["offset"],
        "general_efficiency": ["energy_efficiency", "policy"],
    }

    matched_types: List[str] = []
    for area in focus_areas:
        matched_types.extend(area_to_strategy.get(area, ["energy_efficiency"]))

    # De-duplicate while preserving order.
    seen: set = set()
    unique_types = [t for t in matched_types if not (t in seen or seen.add(t))]  # type: ignore[func-returns-value]

    results: List[Dict[str, Any]] = []
    seen_ids: set = set()
    # Always include at least one policy entry for governance grounding.
    policy_added = False
    for strategy_type in unique_types:
        for entry in KNOWLEDGE_BASE:
            if entry["kb_id"] in seen_ids:
                continue
            if entry["strategy_type"] == strategy_type:
                results.append(entry)
                seen_ids.add(entry["kb_id"])
            if entry["strategy_type"] == "policy" and not policy_added:
                if entry["kb_id"] not in seen_ids:
                    results.append(entry)
                    seen_ids.add(entry["kb_id"])
                    policy_added = True

    return results


def to_evidence_item(entry: Dict[str, Any]) -> Dict[str, Any]:
    """
    Convert a knowledge base entry into an evidence catalog item that matches
    the schema used by _build_evidence_catalog() in service.py.
    """
    primary_citation = entry["citations"][0] if entry["citations"] else entry["title"]
    return {
        "evidence_id": f"kb::{entry['kb_id']}",
        "source_type": "external",
        "source_table": None,
        "source_record_id": None,
        "uri": None,
        "citation": primary_citation,
        "excerpt": (
            f"{entry['title']}: {entry['description']} "
            f"Typical CO2 reduction: {int(entry['reduction_pct_low']*100)}–"
            f"{int(entry['reduction_pct_high']*100)}% of related emissions. "
            f"Confidence: {entry['confidence']:.0%}. "
            f"Sources: {'; '.join(entry['citations'][:2])}."
        ),
        "tags": [entry["strategy_type"], entry["ghg_scope"], "knowledge_base"] + entry["industry_tags"][:3],
        # Extra metadata preserved for the impact calculator to use.
        "_kb_entry": entry,
    }
