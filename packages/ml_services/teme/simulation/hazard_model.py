"""
TEME Hazard Model — Catastrophic Mortality Events

Models discrete mortality events that can kill a fraction of the
tree population in a single year:
  - Drought events (region-dependent)
  - Disease outbreaks (species-dependent)
  - Fire events (region + species dependent)
  - Pest infestations

Each event has:
  - Annual probability of occurring
  - Kill fraction (% of surviving trees lost if event occurs)

These are layered ON TOP of the base annual survival rate,
which models gradual background mortality.

Scientific basis:
  - FAO Global Forest Resources Assessment (catastrophic loss rates)
  - ICFRE fire and drought impact studies
  - Published plantation failure mode analyses
"""

import random
from typing import Dict, List, Optional


# ---------------------------------------------------------------------------
# Hazard event definitions per species
# ---------------------------------------------------------------------------

# Annual probability of each hazard type occurring
# Kill fraction = fraction of surviving trees killed IF event occurs

HAZARD_PROFILES = {
    "Neem": {
        "drought": {"annual_prob": 0.04, "kill_fraction": 0.15},
        "disease": {"annual_prob": 0.02, "kill_fraction": 0.10},
        "fire":    {"annual_prob": 0.01, "kill_fraction": 0.25},
        "pest":    {"annual_prob": 0.03, "kill_fraction": 0.08},
    },
    "Peepal": {
        "drought": {"annual_prob": 0.05, "kill_fraction": 0.20},
        "disease": {"annual_prob": 0.03, "kill_fraction": 0.12},
        "fire":    {"annual_prob": 0.02, "kill_fraction": 0.30},
        "pest":    {"annual_prob": 0.03, "kill_fraction": 0.10},
    },
    "Bamboo": {
        "drought": {"annual_prob": 0.06, "kill_fraction": 0.25},
        "disease": {"annual_prob": 0.04, "kill_fraction": 0.15},
        "fire":    {"annual_prob": 0.05, "kill_fraction": 0.40},
        "pest":    {"annual_prob": 0.04, "kill_fraction": 0.12},
    },
    "Teak": {
        "drought": {"annual_prob": 0.05, "kill_fraction": 0.18},
        "disease": {"annual_prob": 0.03, "kill_fraction": 0.10},
        "fire":    {"annual_prob": 0.02, "kill_fraction": 0.20},
        "pest":    {"annual_prob": 0.02, "kill_fraction": 0.08},
    },
    "Mango": {
        "drought": {"annual_prob": 0.05, "kill_fraction": 0.20},
        "disease": {"annual_prob": 0.04, "kill_fraction": 0.15},
        "fire":    {"annual_prob": 0.02, "kill_fraction": 0.25},
        "pest":    {"annual_prob": 0.04, "kill_fraction": 0.10},
    },
    "Banyan": {
        "drought": {"annual_prob": 0.04, "kill_fraction": 0.15},
        "disease": {"annual_prob": 0.02, "kill_fraction": 0.08},
        "fire":    {"annual_prob": 0.02, "kill_fraction": 0.20},
        "pest":    {"annual_prob": 0.02, "kill_fraction": 0.06},
    },
    "Eucalyptus": {
        "drought": {"annual_prob": 0.07, "kill_fraction": 0.25},
        "disease": {"annual_prob": 0.04, "kill_fraction": 0.15},
        "fire":    {"annual_prob": 0.06, "kill_fraction": 0.45},
        "pest":    {"annual_prob": 0.05, "kill_fraction": 0.12},
    },
    "Acacia": {
        "drought": {"annual_prob": 0.03, "kill_fraction": 0.10},
        "disease": {"annual_prob": 0.03, "kill_fraction": 0.12},
        "fire":    {"annual_prob": 0.03, "kill_fraction": 0.30},
        "pest":    {"annual_prob": 0.04, "kill_fraction": 0.10},
    },
    # --- New India-focused species (calibrated from FAO/ICFRE hazard literature) ---
    "Jamun": {
        "drought": {"annual_prob": 0.05, "kill_fraction": 0.18},
        "disease": {"annual_prob": 0.04, "kill_fraction": 0.15},
        "fire":    {"annual_prob": 0.02, "kill_fraction": 0.20},
        "pest":    {"annual_prob": 0.04, "kill_fraction": 0.12},
    },
    "Pongamia": {
        # Nitrogen-fixer with good systemic resistance
        "drought": {"annual_prob": 0.04, "kill_fraction": 0.15},
        "disease": {"annual_prob": 0.03, "kill_fraction": 0.10},
        "fire":    {"annual_prob": 0.02, "kill_fraction": 0.20},
        "pest":    {"annual_prob": 0.03, "kill_fraction": 0.08},
    },
    "Tamarind": {
        # Extremely drought-tolerant; low drought kill fraction
        "drought": {"annual_prob": 0.02, "kill_fraction": 0.08},
        "disease": {"annual_prob": 0.03, "kill_fraction": 0.12},
        "fire":    {"annual_prob": 0.02, "kill_fraction": 0.15},
        "pest":    {"annual_prob": 0.03, "kill_fraction": 0.10},
    },
    "Arjuna": {
        # Riparian species — vulnerable to drought away from waterways
        "drought": {"annual_prob": 0.06, "kill_fraction": 0.22},
        "disease": {"annual_prob": 0.03, "kill_fraction": 0.10},
        "fire":    {"annual_prob": 0.02, "kill_fraction": 0.18},
        "pest":    {"annual_prob": 0.03, "kill_fraction": 0.08},
    },
    "Moringa": {
        # Fast-growing but susceptible to waterlogging diseases and pests
        "drought": {"annual_prob": 0.03, "kill_fraction": 0.08},
        "disease": {"annual_prob": 0.05, "kill_fraction": 0.20},
        "fire":    {"annual_prob": 0.03, "kill_fraction": 0.25},
        "pest":    {"annual_prob": 0.06, "kill_fraction": 0.15},
    },
    "Casuarina": {
        # Coastal species with high fire risk (resinous, dense canopy)
        # Source: AP coastal forest fire incident data 2018-2021
        "drought": {"annual_prob": 0.05, "kill_fraction": 0.20},
        "disease": {"annual_prob": 0.04, "kill_fraction": 0.15},
        "fire":    {"annual_prob": 0.07, "kill_fraction": 0.50},
        "pest":    {"annual_prob": 0.04, "kill_fraction": 0.12},
    },
    "Sheesham": {
        # Dalbergia sissoo canker/wilt disease is a documented field problem
        "drought": {"annual_prob": 0.05, "kill_fraction": 0.18},
        "disease": {"annual_prob": 0.06, "kill_fraction": 0.20},
        "fire":    {"annual_prob": 0.02, "kill_fraction": 0.20},
        "pest":    {"annual_prob": 0.04, "kill_fraction": 0.12},
    },
    "Khejri": {
        # Sacred desert tree with lowest hazard profile of any Indian species
        "drought": {"annual_prob": 0.02, "kill_fraction": 0.05},
        "disease": {"annual_prob": 0.02, "kill_fraction": 0.08},
        "fire":    {"annual_prob": 0.02, "kill_fraction": 0.15},
        "pest":    {"annual_prob": 0.02, "kill_fraction": 0.08},
    },
    "Amla": {
        # High disease resistance (well-documented in ICAR horticulture studies)
        "drought": {"annual_prob": 0.04, "kill_fraction": 0.15},
        "disease": {"annual_prob": 0.03, "kill_fraction": 0.10},
        "fire":    {"annual_prob": 0.02, "kill_fraction": 0.18},
        "pest":    {"annual_prob": 0.03, "kill_fraction": 0.08},
    },
    "Mahua": {
        # Central India species, moderate fire in dry deciduous belt
        "drought": {"annual_prob": 0.05, "kill_fraction": 0.18},
        "disease": {"annual_prob": 0.03, "kill_fraction": 0.12},
        "fire":    {"annual_prob": 0.04, "kill_fraction": 0.30},
        "pest":    {"annual_prob": 0.03, "kill_fraction": 0.10},
    },
    "Sal": {
        # Moist deciduous forest species; moderate fire + good disease resistance
        "drought": {"annual_prob": 0.06, "kill_fraction": 0.20},
        "disease": {"annual_prob": 0.03, "kill_fraction": 0.10},
        "fire":    {"annual_prob": 0.04, "kill_fraction": 0.25},
        "pest":    {"annual_prob": 0.03, "kill_fraction": 0.08},
    },
    "Chir Pine": {
        # Himalayan pine — very high fire risk (resin + needle litter accumulation)
        # Source: FRI Dehradun forest fire impact assessment 2020
        "drought": {"annual_prob": 0.04, "kill_fraction": 0.15},
        "disease": {"annual_prob": 0.03, "kill_fraction": 0.12},
        "fire":    {"annual_prob": 0.08, "kill_fraction": 0.55},
        "pest":    {"annual_prob": 0.04, "kill_fraction": 0.15},
    },
}

# Default for species not in the table
DEFAULT_HAZARD = {
    "drought": {"annual_prob": 0.05, "kill_fraction": 0.20},
    "disease": {"annual_prob": 0.03, "kill_fraction": 0.12},
    "fire":    {"annual_prob": 0.03, "kill_fraction": 0.30},
    "pest":    {"annual_prob": 0.03, "kill_fraction": 0.10},
}


def get_hazard_profile(species_name: str) -> Dict:
    """Get hazard event profile for a species."""
    return HAZARD_PROFILES.get(species_name, DEFAULT_HAZARD)


def simulate_hazard_events_for_year(
    species_name: str,
    surviving_fraction: float,
    rng: random.Random,
) -> tuple:
    """
    Simulate catastrophic events for one year.

    Args:
        species_name: name of tree species
        surviving_fraction: current fraction alive (0-1)
        rng: seeded random number generator

    Returns:
        (new_surviving_fraction, list_of_events_that_occurred)
    """
    profile = get_hazard_profile(species_name)
    events_occurred = []

    for hazard_type, params in profile.items():
        if rng.random() < params["annual_prob"]:
            # Event occurred — kill a fraction of survivors
            killed = surviving_fraction * params["kill_fraction"]
            surviving_fraction -= killed
            surviving_fraction = max(0.0, surviving_fraction)

            events_occurred.append({
                "type": hazard_type,
                "kill_fraction": params["kill_fraction"],
                "trees_killed_fraction": round(killed, 6),
            })

    return surviving_fraction, events_occurred


def compute_expected_annual_hazard_loss(species_name: str) -> float:
    """
    Compute expected annual loss from hazard events (for reporting).
    E[loss] = Σ prob_i × kill_fraction_i
    """
    profile = get_hazard_profile(species_name)
    expected_loss = 0.0
    for params in profile.values():
        expected_loss += params["annual_prob"] * params["kill_fraction"]
    return round(expected_loss, 6)