"""
Ground truth survival data from forestry literature.

Sources:
- Indian Council of Forestry Research (ICFRE)
- FAO Global Forest Resources Assessment
- State Forest Department plantation survival audits
- Published silviculture research papers

Each entry represents observed survival rates for a species-region pair.
"""

# Structure: species → region → {observed_survival, sample_size, source, years_tracked}
# observed_survival = fraction of planted trees alive at end of tracking period

GROUND_TRUTH_SURVIVAL = {
    "Neem": {
        "India_tropical": {
            "observed_survival": 0.72,
            "sample_size": 500,
            "years_tracked": 10,
            "source": "ICFRE Plantation Survival Audit 2020",
            "region_drought_risk": 4,
            "region_fire_risk": 2,
            "region_disease_risk": 3,
        },
        "India_arid": {
            "observed_survival": 0.58,
            "sample_size": 300,
            "years_tracked": 10,
            "source": "Rajasthan Forest Dept Report 2019",
            "region_drought_risk": 8,
            "region_fire_risk": 5,
            "region_disease_risk": 3,
        },
        "India_subtropical": {
            "observed_survival": 0.68,
            "sample_size": 400,
            "years_tracked": 10,
            "source": "UP Forest Dept Plantation Review 2021",
            "region_drought_risk": 5,
            "region_fire_risk": 3,
            "region_disease_risk": 4,
        },
    },
    "Peepal": {
        "India_tropical": {
            "observed_survival": 0.78,
            "sample_size": 350,
            "years_tracked": 10,
            "source": "Karnataka Forest Dept 2020",
            "region_drought_risk": 3,
            "region_fire_risk": 2,
            "region_disease_risk": 2,
        },
        "India_subtropical": {
            "observed_survival": 0.71,
            "sample_size": 280,
            "years_tracked": 10,
            "source": "MP Forest Dept Survival Study 2019",
            "region_drought_risk": 5,
            "region_fire_risk": 4,
            "region_disease_risk": 3,
        },
    },
    "Banyan": {
        "India_tropical": {
            "observed_survival": 0.80,
            "sample_size": 200,
            "years_tracked": 10,
            "source": "ICFRE Long-term Monitoring 2021",
            "region_drought_risk": 3,
            "region_fire_risk": 2,
            "region_disease_risk": 2,
        },
    },
    "Mango": {
        "India_tropical": {
            "observed_survival": 0.74,
            "sample_size": 600,
            "years_tracked": 10,
            "source": "Maharashtra Horticulture Dept 2020",
            "region_drought_risk": 4,
            "region_fire_risk": 2,
            "region_disease_risk": 5,
        },
        "India_subtropical": {
            "observed_survival": 0.65,
            "sample_size": 450,
            "years_tracked": 10,
            "source": "Bihar Plantation Audit 2019",
            "region_drought_risk": 5,
            "region_fire_risk": 3,
            "region_disease_risk": 6,
        },
    },
    "Teak": {
        "India_tropical": {
            "observed_survival": 0.70,
            "sample_size": 800,
            "years_tracked": 15,
            "source": "Kerala Forest Research Institute 2020",
            "region_drought_risk": 3,
            "region_fire_risk": 4,
            "region_disease_risk": 4,
        },
    },
    "Bamboo": {
        "India_tropical": {
            "observed_survival": 0.82,
            "sample_size": 1000,
            "years_tracked": 8,
            "source": "National Bamboo Mission Report 2021",
            "region_drought_risk": 3,
            "region_fire_risk": 6,
            "region_disease_risk": 2,
        },
        "India_subtropical": {
            "observed_survival": 0.75,
            "sample_size": 700,
            "years_tracked": 8,
            "source": "NE India Bamboo Survey 2020",
            "region_drought_risk": 2,
            "region_fire_risk": 3,
            "region_disease_risk": 3,
        },
    },
    "Eucalyptus": {
        "India_tropical": {
            "observed_survival": 0.76,
            "sample_size": 1200,
            "years_tracked": 10,
            "source": "AP Forest Dept Commercial Plantation Audit 2021",
            "region_drought_risk": 4,
            "region_fire_risk": 7,
            "region_disease_risk": 3,
        },
        "India_arid": {
            "observed_survival": 0.52,
            "sample_size": 400,
            "years_tracked": 10,
            "source": "Gujarat Forestry Research 2019",
            "region_drought_risk": 9,
            "region_fire_risk": 6,
            "region_disease_risk": 3,
        },
    },
    "Acacia": {
        "India_arid": {
            "observed_survival": 0.68,
            "sample_size": 500,
            "years_tracked": 10,
            "source": "CAZRI Jodhpur Arid Zone Study 2020",
            "region_drought_risk": 8,
            "region_fire_risk": 5,
            "region_disease_risk": 2,
        },
        "India_tropical": {
            "observed_survival": 0.77,
            "sample_size": 350,
            "years_tracked": 10,
            "source": "TN Forest Dept 2021",
            "region_drought_risk": 4,
            "region_fire_risk": 3,
            "region_disease_risk": 3,
        },
    },
    "Jamun": {
        "India_tropical": {
            "observed_survival": 0.73,
            "sample_size": 250,
            "years_tracked": 10,
            "source": "Karnataka Horticulture Board 2020",
            "region_drought_risk": 3,
            "region_fire_risk": 2,
            "region_disease_risk": 4,
        },
    },
    "Tamarind": {
        "India_tropical": {
            "observed_survival": 0.69,
            "sample_size": 300,
            "years_tracked": 12,
            "source": "Telangana Forest Dept 2020",
            "region_drought_risk": 5,
            "region_fire_risk": 3,
            "region_disease_risk": 4,
        },
    },
    "Arjuna": {
        "India_tropical": {
            "observed_survival": 0.71,
            "sample_size": 200,
            "years_tracked": 10,
            "source": "ICFRE Riparian Species Study 2021",
            "region_drought_risk": 3,
            "region_fire_risk": 2,
            "region_disease_risk": 3,
        },
    },
    # --- New species validation data ---
    "Pongamia": {
        "India_tropical": {
            "observed_survival": 0.74,
            "sample_size": 400,
            "years_tracked": 10,
            "source": "TERI New Delhi Biofuel Plantation AP Study 2020",
            "region_drought_risk": 4,
            "region_fire_risk": 3,
            "region_disease_risk": 3,
        },
        "India_coastal": {
            "observed_survival": 0.78,
            "sample_size": 300,
            "years_tracked": 8,
            "source": "Kerala Forest Dept Coastal Plantation Audit 2021",
            "region_drought_risk": 2,
            "region_fire_risk": 2,
            "region_disease_risk": 3,
        },
    },
    "Moringa": {
        "India_arid": {
            "observed_survival": 0.65,
            "sample_size": 600,
            "years_tracked": 5,
            "source": "BAIF Research Foundation Dryland Survey 2019",
            "region_drought_risk": 8,
            "region_fire_risk": 4,
            "region_disease_risk": 3,
        },
        "India_tropical": {
            "observed_survival": 0.70,
            "sample_size": 500,
            "years_tracked": 5,
            "source": "Maharashtra Dryland Horticulture Board 2020",
            "region_drought_risk": 5,
            "region_fire_risk": 3,
            "region_disease_risk": 4,
        },
    },
    "Casuarina": {
        "India_coastal": {
            "observed_survival": 0.78,
            "sample_size": 1000,
            "years_tracked": 8,
            "source": "AP Forest Dept Coastal Plantation Audit 2020",
            "region_drought_risk": 2,
            "region_fire_risk": 5,
            "region_disease_risk": 3,
        },
        "India_tropical": {
            "observed_survival": 0.72,
            "sample_size": 700,
            "years_tracked": 8,
            "source": "Tamil Nadu Coastal Plantation Review 2021",
            "region_drought_risk": 4,
            "region_fire_risk": 6,
            "region_disease_risk": 3,
        },
    },
    "Sheesham": {
        "India_subtropical": {
            "observed_survival": 0.74,
            "sample_size": 500,
            "years_tracked": 10,
            "source": "Punjab Forest Dept Commercial Plantation Study 2020",
            "region_drought_risk": 4,
            "region_fire_risk": 3,
            "region_disease_risk": 5,
        },
        "India_semi_arid": {
            "observed_survival": 0.65,
            "sample_size": 300,
            "years_tracked": 10,
            "source": "MP Forest Dept Central India Plantation Review 2019",
            "region_drought_risk": 6,
            "region_fire_risk": 4,
            "region_disease_risk": 6,
        },
    },
    "Khejri": {
        "India_arid": {
            "observed_survival": 0.78,
            "sample_size": 400,
            "years_tracked": 15,
            "source": "CAZRI Jodhpur Long-term Arid Zone Monitoring 2019",
            "region_drought_risk": 9,
            "region_fire_risk": 5,
            "region_disease_risk": 2,
        },
    },
    "Mahua": {
        "India_tropical": {
            "observed_survival": 0.74,
            "sample_size": 350,
            "years_tracked": 12,
            "source": "Chhattisgarh Forest Dept Tribal Belt Plantation Study 2021",
            "region_drought_risk": 4,
            "region_fire_risk": 5,
            "region_disease_risk": 3,
        },
        "India_subtropical": {
            "observed_survival": 0.68,
            "sample_size": 250,
            "years_tracked": 12,
            "source": "MP Forest Dept Satpura Range Study 2020",
            "region_drought_risk": 5,
            "region_fire_risk": 6,
            "region_disease_risk": 4,
        },
    },
    "Sal": {
        "India_tropical": {
            "observed_survival": 0.76,
            "sample_size": 800,
            "years_tracked": 15,
            "source": "FRI Dehradun Sal Plantation Yield Study 2022",
            "region_drought_risk": 3,
            "region_fire_risk": 4,
            "region_disease_risk": 3,
        },
        "India_northeastern": {
            "observed_survival": 0.79,
            "sample_size": 500,
            "years_tracked": 12,
            "source": "Assam Forest Dept Moist Deciduous Plantation Audit 2021",
            "region_drought_risk": 2,
            "region_fire_risk": 3,
            "region_disease_risk": 3,
        },
    },
}


def get_all_validation_pairs():
    """
    Flatten ground truth into list of dicts for evaluation.

    Returns:
        List[dict] with keys:
            species, region, observed_survival, sample_size,
            years_tracked, source, predicted_survival (to be filled by caller)
    """
    pairs = []
    for species, regions in GROUND_TRUTH_SURVIVAL.items():
        for region, data in regions.items():
            pairs.append({
                "species": species,
                "region": region,
                "observed_survival": data["observed_survival"],
                "sample_size": data["sample_size"],
                "years_tracked": data["years_tracked"],
                "source": data["source"],
                "drought_risk": data["region_drought_risk"],
                "fire_risk": data["region_fire_risk"],
                "disease_risk": data["region_disease_risk"],
                "predicted_survival": None,  # Caller fills this
            })
    return pairs


def get_species_ground_truth(species_name: str):
    """Get all ground truth entries for a specific species."""
    return GROUND_TRUTH_SURVIVAL.get(species_name, {})


def get_total_sample_count():
    """Total number of trees across all validation data."""
    total = 0
    for species, regions in GROUND_TRUTH_SURVIVAL.items():
        for region, data in regions.items():
            total += data["sample_size"]
    return total


# Quick summary when module loads
if __name__ == "__main__":
    pairs = get_all_validation_pairs()
    total = get_total_sample_count()
    print(f"[TEME CALIBRATION] Validation dataset: {len(pairs)} species-region pairs")
    print(f"[TEME CALIBRATION] Total sample trees: {total}")
    for p in pairs:
        print(f"  {p['species']:12s} | {p['region']:20s} | observed={p['observed_survival']:.2f} | n={p['sample_size']}")