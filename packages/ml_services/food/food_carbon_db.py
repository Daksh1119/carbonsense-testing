"""
food_carbon_db.py
─────────────────
Carbon emission factors for food items recognised by the food recognition model.

Values in kg CO₂e per 100g serving.
Sources: DEFRA 2023, OurWorldInData, Poore & Nemecek 2018 (Science).

Used by inference.py to attach carbon estimates to predictions.
"""

from __future__ import annotations

# ─── Food-101 classes → carbon (kg CO₂e per 100g) ───────────────────────────
# Full 101-class mapping.  DEFAULT_CARBON used for any unmapped class.

FOOD101_CARBON: dict[str, float] = {
    # ── Beef-heavy ──────────────────────────────────────────────────────────
    "beef_carpaccio": 2.50,   "beef_tartare": 2.50,
    "filet_mignon": 2.50,     "hamburger": 2.20,
    "steak": 2.50,            "prime_rib": 2.50,
    # ── Pork ────────────────────────────────────────────────────────────────
    "baby_back_ribs": 1.20,   "pork_chop": 1.20,
    "pulled_pork_sandwich": 1.10,
    # ── Poultry ─────────────────────────────────────────────────────────────
    "chicken_curry": 0.65,    "chicken_wings": 0.65,
    "chicken_quesadilla": 0.60, "hot_dog": 0.80,
    "fried_chicken": 0.70,
    # ── Seafood ─────────────────────────────────────────────────────────────
    "grilled_salmon": 0.50,   "lobster_bisque": 0.80,
    "shrimp_and_grits": 0.70, "crab_cakes": 0.75,
    "fish_and_chips": 0.55,   "oysters": 0.60,
    "clam_chowder": 0.45,     "escargots": 0.30,
    "mussels": 0.40,          "tuna_tartare": 0.55,
    "sashimi": 0.55,
    # ── Pizza / pasta ────────────────────────────────────────────────────────
    "pizza": 0.60,            "spaghetti_bolognese": 1.20,
    "spaghetti_carbonara": 0.90, "lasagna": 1.10,
    "macaroni_and_cheese": 0.80,
    # ── Rice / Asian ─────────────────────────────────────────────────────────
    "bibimbap": 0.70,         "fried_rice": 0.50,
    "pad_thai": 0.55,         "pho": 0.60,
    "ramen": 0.65,            "dumplings": 0.55,
    "gyoza": 0.55,            "spring_rolls": 0.40,
    "takoyaki": 0.60,         "peking_duck": 1.80,
    "dim_sum": 0.60,
    # ── Japanese ─────────────────────────────────────────────────────────────
    "sushi": 0.50,            "edamame": 0.10,
    "miso_soup": 0.15,        "onigiri": 0.35,
    # ── Mexican ──────────────────────────────────────────────────────────────
    "tacos": 0.80,            "burritos": 0.75,
    "nachos": 0.50,           "guacamole": 0.20,
    # ── Burgers / sandwiches / soups / salads ─────────────────────────────────
    "club_sandwich": 0.65,    "hot_and_sour_soup": 0.20,
    "french_onion_soup": 0.35, "caesar_salad": 0.15,
    "caprese_salad": 0.25,    "greek_salad": 0.20,
    # ── Vegetarian / vegan ───────────────────────────────────────────────────
    "hummus": 0.10,           "falafel": 0.15,
    "bruschetta": 0.20,       "gnocchi": 0.35,
    "risotto": 0.35,          "grilled_cheese_sandwich": 0.55,
    "poutine": 0.55,
    # ── Eggs / breakfast ─────────────────────────────────────────────────────
    "eggs_benedict": 0.45,    "french_toast": 0.40,
    "pancakes": 0.35,         "waffles": 0.35,
    "breakfast_burrito": 0.60,
    # ── Baked goods / desserts ────────────────────────────────────────────────
    "apple_pie": 0.25,        "baklava": 0.40,
    "cannoli": 0.45,          "carrot_cake": 0.30,
    "cheesecake": 0.40,       "chocolate_cake": 0.35,
    "chocolate_mousse": 0.30, "churros": 0.30,
    "creme_brulee": 0.35,     "cup_cakes": 0.30,
    "donuts": 0.30,           "macarons": 0.25,
    "red_velvet_cake": 0.30,  "strawberry_shortcake": 0.25,
    "tiramisu": 0.35,         "ice_cream": 0.30,
    "frozen_yogurt": 0.20,
    # ── Fried / snacks ────────────────────────────────────────────────────────
    "french_fries": 0.30,     "onion_rings": 0.25,
    "chicken_nuggets": 0.70,  "deviled_eggs": 0.40,
    "bread_pudding": 0.30,    "samosa": 0.25,
    # ── Cheese / dairy ────────────────────────────────────────────────────────
    "cheese_plate": 1.50,     "foie_gras": 3.50,
}

DEFAULT_CARBON: float = 0.35   # fallback for unmapped Food-101 classes


# ─── Indian food classes → carbon ────────────────────────────────────────────
# Used by the Indian food fine-tune model.

INDIAN_FOOD_CARBON: dict[str, float] = {
    # ── South Indian ─────────────────────────────────────────────────────────
    "idli": 0.10,           "vada": 0.20,            "dosa": 0.15,
    "masala_dosa": 0.20,    "uttapam": 0.18,         "appam": 0.15,
    "sambar": 0.12,         "rasam": 0.08,           "avial": 0.14,
    "puttu": 0.12,          "kerala_fish_curry": 0.55,
    # ── North Indian ─────────────────────────────────────────────────────────
    "butter_chicken": 0.70, "dal_makhani": 0.25,     "palak_paneer": 0.45,
    "aloo_paratha": 0.30,   "chole_bhature": 0.40,   "rajma": 0.20,
    "kadhi": 0.18,          "shahi_paneer": 0.50,    "matar_paneer": 0.45,
    "dal_tadka": 0.15,      "jeera_rice": 0.30,      "naan": 0.18,
    "roti": 0.12,           "chapati": 0.12,         "paratha": 0.28,
    "biryani": 0.75,        "pulao": 0.35,           "khichdi": 0.18,
    # ── Street food / snacks ──────────────────────────────────────────────────
    "pav_bhaji": 0.35,      "bhel_puri": 0.12,       "pani_puri": 0.10,
    "kachori": 0.28,        "dhokla": 0.12,
    "poha": 0.15,           "upma": 0.14,            "halwa": 0.30,
    "jalebi": 0.28,         "gulab_jamun": 0.32,     "ladoo": 0.35,
    "pakora": 0.22,         "bhajiya": 0.22,         "vada_pav": 0.30,
    # ── Sweets / desserts ────────────────────────────────────────────────────
    "kheer": 0.28,          "rasgulla": 0.25,        "sandesh": 0.30,
    "barfi": 0.35,          "mysore_pak": 0.38,      "rabri": 0.40,
    # ── Meat ─────────────────────────────────────────────────────────────────
    "chicken_tikka": 0.65,  "tandoori_chicken": 0.65, "mutton_curry": 1.20,
    "keema": 1.10,          "seekh_kebab": 1.00,     "fish_curry": 0.55,
    "prawn_curry": 0.65,
}

ALL_CARBON_DB: dict[str, float] = {**FOOD101_CARBON, **INDIAN_FOOD_CARBON}


def get_carbon(food_key: str) -> float:
    """Return CO₂e per 100g for a food class. Uses DEFAULT_CARBON if unknown."""
    key = food_key.lower().replace(" ", "_")
    return ALL_CARBON_DB.get(key, DEFAULT_CARBON)
