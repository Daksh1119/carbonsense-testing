"""
TEME Species Catalog

Each species entry contains:
  - regions: list of regions where species can grow
  - maturity_years: years to reach peak sequestration
  - peak_sequestration_kg: annual CO2 absorption at maturity (kg/tree/year)
  - annual_survival_rate: fraction surviving each year (compound)
  - land_per_tree: hectares required per tree
  - priority: base ranking score (0-1)
  - growth_rate_class: 1-10 (10 = fastest)
  - drought_score: 1-10 (10 = most resistant)
  - fire_score: 1-10 (10 = most resistant)
  - disease_score: 1-10 (10 = most resistant)
  - cost_per_tree_total_inr: total plantation cost per tree (INR)
    Includes: sapling + land prep + planting labor + 3yr maintenance +
    fencing + monitoring. Source: ICFRE plantation cost guidelines.

Sources:
  - ICFRE (Indian Council of Forestry Research & Education)
  - FAO Species Database
  - State Forest Department reports
  - Published silviculture literature
"""

SPECIES_CATALOG = {
    "Neem": {
        "regions": ["India", "India_tropical", "India_arid", "India_subtropical"],
        "maturity_years": 6,
        "peak_sequestration_kg": 25.0,
        "annual_survival_rate": 0.95,
        "land_per_tree": 0.01,
        "priority": 0.9,
        "growth_rate_class": 7,
        "drought_score": 8,
        "fire_score": 7,
        "disease_score": 8,
        "cost_per_tree_total_inr": 450,
    },
    "Peepal": {
        "regions": ["India", "India_tropical", "India_subtropical"],
        "maturity_years": 8,
        "peak_sequestration_kg": 30.0,
        "annual_survival_rate": 0.93,
        "land_per_tree": 0.015,
        "priority": 0.85,
        "growth_rate_class": 5,
        "drought_score": 6,
        "fire_score": 5,
        "disease_score": 6,
        "cost_per_tree_total_inr": 500,
    },
    "Bamboo": {
        "regions": ["India", "India_tropical", "India_subtropical"],
        "maturity_years": 3,
        "peak_sequestration_kg": 20.0,
        "annual_survival_rate": 0.90,
        "land_per_tree": 0.008,
        "priority": 0.8,
        "growth_rate_class": 9,
        "drought_score": 5,
        "fire_score": 6,
        "disease_score": 7,
        "cost_per_tree_total_inr": 350,
    },
    "Teak": {
        "regions": ["India", "India_tropical"],
        "maturity_years": 10,
        "peak_sequestration_kg": 22.0,
        "annual_survival_rate": 0.93,
        "land_per_tree": 0.012,
        "priority": 0.75,
        "growth_rate_class": 4,
        "drought_score": 5,
        "fire_score": 6,
        "disease_score": 7,
        "cost_per_tree_total_inr": 650,
    },
    "Mango": {
        "regions": ["India", "India_tropical", "India_subtropical"],
        "maturity_years": 7,
        "peak_sequestration_kg": 18.0,
        "annual_survival_rate": 0.94,
        "land_per_tree": 0.012,
        "priority": 0.7,
        "growth_rate_class": 5,
        "drought_score": 6,
        "fire_score": 5,
        "disease_score": 6,
        "cost_per_tree_total_inr": 550,
    },
    "Banyan": {
        "regions": ["India", "India_tropical"],
        "maturity_years": 10,
        "peak_sequestration_kg": 35.0,
        "annual_survival_rate": 0.96,
        "land_per_tree": 0.025,
        "priority": 0.65,
        "growth_rate_class": 4,
        "drought_score": 6,
        "fire_score": 5,
        "disease_score": 7,
        "cost_per_tree_total_inr": 600,
    },
    "Eucalyptus": {
        "regions": ["India", "India_tropical", "India_arid"],
        "maturity_years": 5,
        "peak_sequestration_kg": 28.0,
        "annual_survival_rate": 0.92,
        "land_per_tree": 0.009,
        "priority": 0.6,
        "growth_rate_class": 8,
        "drought_score": 4,
        "fire_score": 4,
        "disease_score": 5,
        "cost_per_tree_total_inr": 380,
    },
    "Acacia": {
        "regions": ["India", "India_tropical", "India_arid"],
        "maturity_years": 4,
        "peak_sequestration_kg": 15.0,
        "annual_survival_rate": 0.91,
        "land_per_tree": 0.008,
        "priority": 0.55,
        "growth_rate_class": 8,
        "drought_score": 9,
        "fire_score": 6,
        "disease_score": 7,
        "cost_per_tree_total_inr": 300,
    },
}