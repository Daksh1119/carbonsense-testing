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
        "regions": ["India", "India_tropical", "India_arid", "India_subtropical", "India_semi_arid"],
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
        "regions": ["India", "India_tropical", "India_subtropical", "India_semi_arid"],
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
        "regions": ["India", "India_tropical", "India_subtropical", "India_coastal", "India_northeastern"],
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
        "regions": ["India", "India_tropical", "India_coastal", "India_northeastern"],
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
        "regions": ["India", "India_tropical", "India_subtropical", "India_coastal", "India_semi_arid"],
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
        "regions": ["India", "India_tropical", "India_coastal", "India_semi_arid"],
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
        "regions": ["India", "India_tropical", "India_arid", "India_semi_arid", "India_coastal"],
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
        "regions": ["India", "India_tropical", "India_arid", "India_semi_arid", "India_himalayan"],
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
    # -----------------------------------------------------------------------
    # NEW INDIA-FOCUSED SPECIES (calibrated from ICFRE / FAO / State Forest data)
    # Sources: ICFRE Plantation Manuals 2020-2022, FAO Tree Species Profiles,
    #          State Forest Dept plantation audits, ICAR/TERI research papers
    # -----------------------------------------------------------------------
    "Jamun": {
        "regions": ["India", "India_tropical", "India_subtropical", "India_semi_arid", "India_coastal"],
        "maturity_years": 8,
        "peak_sequestration_kg": 22.0,
        "annual_survival_rate": 0.94,
        "land_per_tree": 0.012,
        "priority": 0.71,
        "growth_rate_class": 5,
        "drought_score": 6,
        "fire_score": 5,
        "disease_score": 6,
        "cost_per_tree_total_inr": 500,
    },
    "Pongamia": {
        # Millettia pinnata (Karanja) — nitrogen-fixing multipurpose tree
        # Source: TERI New Delhi biofuel plantation studies 2018-2021
        "regions": ["India", "India_tropical", "India_coastal", "India_semi_arid"],
        "maturity_years": 6,
        "peak_sequestration_kg": 18.0,
        "annual_survival_rate": 0.92,
        "land_per_tree": 0.01,
        "priority": 0.73,
        "growth_rate_class": 6,
        "drought_score": 7,
        "fire_score": 5,
        "disease_score": 7,
        "cost_per_tree_total_inr": 400,
    },
    "Tamarind": {
        # Tamarindus indica — extremely long-lived, arid-tolerant
        # Source: Tamil Nadu Forest Dept plantation survival reports 2019-2021
        "regions": ["India_tropical", "India_arid", "India_semi_arid"],
        "maturity_years": 10,
        "peak_sequestration_kg": 20.0,
        "annual_survival_rate": 0.93,
        "land_per_tree": 0.015,
        "priority": 0.66,
        "growth_rate_class": 4,
        "drought_score": 9,
        "fire_score": 6,
        "disease_score": 8,
        "cost_per_tree_total_inr": 450,
    },
    "Arjuna": {
        # Terminalia arjuna — riparian carbon-dense tree
        # Source: ICFRE Riparian Species Long-term Monitoring Study 2021
        "regions": ["India_tropical", "India_subtropical", "India_semi_arid"],
        "maturity_years": 8,
        "peak_sequestration_kg": 24.0,
        "annual_survival_rate": 0.94,
        "land_per_tree": 0.012,
        "priority": 0.69,
        "growth_rate_class": 5,
        "drought_score": 5,
        "fire_score": 5,
        "disease_score": 6,
        "cost_per_tree_total_inr": 550,
    },
    "Moringa": {
        # Moringa oleifera (Drumstick) — ultra-fast, drought-tolerant dryland species
        # Source: BAIF Research Foundation dryland plantation 2019
        "regions": ["India", "India_tropical", "India_arid", "India_semi_arid"],
        "maturity_years": 3,
        "peak_sequestration_kg": 12.0,
        "annual_survival_rate": 0.88,
        "land_per_tree": 0.006,
        "priority": 0.62,
        "growth_rate_class": 9,
        "drought_score": 9,
        "fire_score": 5,
        "disease_score": 6,
        "cost_per_tree_total_inr": 250,
    },
    "Casuarina": {
        # Casuarina equisetifolia — fastest coastal carbon accumulator
        # Source: AP Forest Dept Coastal Plantation Audit 2020
        "regions": ["India_coastal", "India_tropical"],
        "maturity_years": 4,
        "peak_sequestration_kg": 30.0,
        "annual_survival_rate": 0.88,
        "land_per_tree": 0.008,
        "priority": 0.67,
        "growth_rate_class": 9,
        "drought_score": 4,
        "fire_score": 3,
        "disease_score": 5,
        "cost_per_tree_total_inr": 350,
    },
    "Sheesham": {
        # Dalbergia sissoo (Indian Rosewood) — subtropical/sub-himalayan timber+carbon
        # Source: Punjab Forest Dept commercial plantation study 2020
        "regions": ["India_subtropical", "India_semi_arid", "India_himalayan"],
        "maturity_years": 8,
        "peak_sequestration_kg": 22.0,
        "annual_survival_rate": 0.92,
        "land_per_tree": 0.01,
        "priority": 0.71,
        "growth_rate_class": 6,
        "drought_score": 6,
        "fire_score": 5,
        "disease_score": 5,
        "cost_per_tree_total_inr": 600,
    },
    "Khejri": {
        # Prosopis cineraria — sacred Rajasthan 'Kalpavriksha', ultra-arid specialist
        # Source: CAZRI Jodhpur long-term monitoring 2019
        "regions": ["India_arid"],
        "maturity_years": 12,
        "peak_sequestration_kg": 10.0,
        "annual_survival_rate": 0.93,
        "land_per_tree": 0.01,
        "priority": 0.59,
        "growth_rate_class": 3,
        "drought_score": 10,
        "fire_score": 7,
        "disease_score": 8,
        "cost_per_tree_total_inr": 350,
    },
    "Amla": {
        # Phyllanthus emblica (Indian Gooseberry) — medicinal + carbon, highly disease resistant
        # Source: ICAR CISH Lucknow horticultural plantation study 2020
        "regions": ["India", "India_tropical", "India_subtropical", "India_semi_arid"],
        "maturity_years": 7,
        "peak_sequestration_kg": 16.0,
        "annual_survival_rate": 0.93,
        "land_per_tree": 0.01,
        "priority": 0.69,
        "growth_rate_class": 5,
        "drought_score": 7,
        "fire_score": 5,
        "disease_score": 8,
        "cost_per_tree_total_inr": 480,
    },
    "Mahua": {
        # Madhuca longifolia — central India tribal belt species, valuable for communities
        # Source: ICFRE Central India tribal plantation monitoring 2021
        "regions": ["India_tropical", "India_subtropical"],
        "maturity_years": 10,
        "peak_sequestration_kg": 20.0,
        "annual_survival_rate": 0.92,
        "land_per_tree": 0.015,
        "priority": 0.64,
        "growth_rate_class": 4,
        "drought_score": 6,
        "fire_score": 5,
        "disease_score": 6,
        "cost_per_tree_total_inr": 520,
    },
    "Sal": {
        # Shorea robusta — dominant eastern India forest species, dense carbon wood
        # Source: Forest Research Institute Dehradun long-term yield study 2022
        "regions": ["India_tropical", "India_northeastern"],
        "maturity_years": 12,
        "peak_sequestration_kg": 26.0,
        "annual_survival_rate": 0.91,
        "land_per_tree": 0.015,
        "priority": 0.73,
        "growth_rate_class": 4,
        "drought_score": 5,
        "fire_score": 5,
        "disease_score": 6,
        "cost_per_tree_total_inr": 700,
    },
    "Chir Pine": {
        # Pinus roxburghii — primary Himalayan reforestation species
        # Source: FRI Dehradun Himalayan pine plantation study 2021
        "regions": ["India_himalayan"],
        "maturity_years": 15,
        "peak_sequestration_kg": 24.0,
        "annual_survival_rate": 0.90,
        "land_per_tree": 0.012,
        "priority": 0.70,
        "growth_rate_class": 3,
        "drought_score": 6,
        "fire_score": 3,
        "disease_score": 6,
        "cost_per_tree_total_inr": 600,
    },
}