"""
carbon_mapper.py
────────────────
Fuzzy keyword-based carbon factor mapping for receipt line items.

_KEYWORD_FACTORS  – master list of {keywords, category, carbon_kg} entries
                    covering food & beverages, transport, fuel, accommodation,
                    electronics, clothing, grocery, and healthcare.
_match_item()     – iterates compiled regex patterns; first hit wins.
                    Falls back to {"unknown", 0.0} when no match found.
calculate_receipt_carbon() – public API consumed by single_processor.

Carbon intensities in kg CO₂e per item/unit.
Sources: DEFRA 2023 conversion factors, IPCC AR6, Our World in Data.
"""

from __future__ import annotations

import re
from typing import Dict, List


# ─── Master database ──────────────────────────────────────────────────────────

_KEYWORD_FACTORS: List[Dict] = [
    # ── Hot beverages ──────────────────────────────────────────────────────────
    {"keywords": ["coffee", "espresso", "latte", "macchiato", "cappuccino",
                  "americano", "mocha", "flat white", "affogato"],
     "category": "beverages", "carbon_kg": 0.21},
    {"keywords": ["tea", "chai", "herbal", "green tea", "matcha"],
     "category": "beverages", "carbon_kg": 0.03},
    # ── Cold / soft drinks ─────────────────────────────────────────────────────
    {"keywords": ["cola", "pepsi", "coke", "fanta", "sprite", "soda",
                  "soft drink", "lemonade", "juice", "smoothie", "milkshake"],
     "category": "beverages", "carbon_kg": 0.14},
    {"keywords": ["water", "mineral water", "still water", "sparkling water"],
     "category": "beverages", "carbon_kg": 0.05},
    {"keywords": ["milk", "milch", "dairy drink", "lassi"],
     "category": "beverages", "carbon_kg": 0.61},
    # ── Alcoholic drinks ───────────────────────────────────────────────────────
    {"keywords": ["beer", "ale", "lager", "pint", "bier", "craft beer"],
     "category": "beverages_alcohol", "carbon_kg": 0.43},
    {"keywords": ["wine", "champagne", "prosecco", "rosé", "merlot",
                  "cabernet", "chardonnay", "sauvignon", "sparkling wine"],
     "category": "beverages_alcohol", "carbon_kg": 0.68},
    {"keywords": ["spirits", "whiskey", "whisky", "vodka", "rum", "gin",
                  "tequila", "schnapps", "gloki", "brandy", "cognac",
                  "liqueur", "shot"],
     "category": "beverages_alcohol", "carbon_kg": 0.91},
    # ── Beef / veal ────────────────────────────────────────────────────────────
    {"keywords": ["beef", "steak", "burger", "hamburger", "veal",
                  "kalbfleisch", "ribeye", "sirloin", "brisket", "meatball"],
     "category": "food_beef", "carbon_kg": 6.1},
    # ── Lamb ───────────────────────────────────────────────────────────────────
    {"keywords": ["lamb", "mutton", "lammfleisch"],
     "category": "food_lamb", "carbon_kg": 5.5},
    # ── Pork ───────────────────────────────────────────────────────────────────
    {"keywords": ["pork", "schwein", "bacon", "ham", "sausage", "wurst",
                  "bratwurst", "schnitzel", "schweinschnitzel", "ribs",
                  "pork chop", "chorizo", "salami", "prosciutto", "pancetta",
                  "pepperoni"],
     "category": "food_pork", "carbon_kg": 2.9},
    # ── Poultry ────────────────────────────────────────────────────────────────
    {"keywords": ["chicken", "hähnchen", "huhn", "poultry", "turkey",
                  "duck", "breast", "wings", "nuggets", "grilled chicken"],
     "category": "food_poultry", "carbon_kg": 1.5},
    # ── Seafood ────────────────────────────────────────────────────────────────
    {"keywords": ["fish", "salmon", "tuna", "cod", "seafood", "prawn",
                  "shrimp", "lobster", "crab", "trout", "forelle",
                  "sea bass", "swordfish", "anchovy", "calamari", "squid"],
     "category": "food_seafood", "carbon_kg": 1.8},
    # ── Pizza / pasta ──────────────────────────────────────────────────────────
    {"keywords": ["pizza", "pasta", "spaghetti", "lasagna", "risotto",
                  "gnocchi", "ravioli", "penne", "fettuccine", "tagliatelle"],
     "category": "food_prepared", "carbon_kg": 1.2},
    # ── Asian / rice dishes ────────────────────────────────────────────────────
    {"keywords": ["biryani", "fried rice", "pilaf", "paella",
                  "noodles", "ramen", "pho", "pad thai", "lo mein"],
     "category": "food_prepared", "carbon_kg": 1.0},
    {"keywords": ["rice"],
     "category": "food_prepared", "carbon_kg": 0.4},
    # ── Sandwiches & wraps ─────────────────────────────────────────────────────
    {"keywords": ["sandwich", "wrap", "sub", "panini", "baguette",
                  "toast", "roll", "hoagie", "club sandwich"],
     "category": "food_prepared", "carbon_kg": 0.7},
    # ── Salads ─────────────────────────────────────────────────────────────────
    {"keywords": ["salad", "caesar", "greek salad", "coleslaw",
                  "garden salad"],
     "category": "food_vegetarian", "carbon_kg": 0.3},
    # ── Soups & stews ──────────────────────────────────────────────────────────
    {"keywords": ["soup", "suppe", "broth", "stew", "chowder", "bisque",
                  "minestrone", "tom yum"],
     "category": "food_prepared", "carbon_kg": 0.5},
    # ── Curries ────────────────────────────────────────────────────────────────
    {"keywords": ["curry", "korma", "tikka", "masala", "dal", "dhal",
                  "saag", "vindaloo", "paneer"],
     "category": "food_prepared", "carbon_kg": 1.1},
    # ── Döner / kebab ──────────────────────────────────────────────────────────
    {"keywords": ["döner", "kebab", "gyros", "shawarma", "doner"],
     "category": "food_prepared", "carbon_kg": 2.0},
    # ── Alpine / Central-European dishes ──────────────────────────────────────
    {"keywords": ["chasspatz", "spätzle", "spaetzle", "knödel",
                  "dumpling", "rösti", "pretzel", "bretzel", "fondue",
                  "raclette"],
     "category": "food_prepared", "carbon_kg": 0.8},
    # ── Mexican ────────────────────────────────────────────────────────────────
    {"keywords": ["taco", "burrito", "quesadilla", "enchilada", "nacho",
                  "fajita", "guacamole"],
     "category": "food_prepared", "carbon_kg": 1.4},
    # ── Japanese ──────────────────────────────────────────────────────────────
    {"keywords": ["sushi", "sashimi", "maki", "nigiri", "tempura",
                  "edamame", "miso"],
     "category": "food_prepared", "carbon_kg": 1.0},
    # ── Desserts ───────────────────────────────────────────────────────────────
    {"keywords": ["dessert", "cake", "torte", "ice cream", "gelato",
                  "tiramisu", "pudding", "tart", "brownie", "cheesecake",
                  "mousse", "eclair", "waffle", "crepe", "pancake"],
     "category": "food_dessert", "carbon_kg": 0.8},
    # ── Baked goods ────────────────────────────────────────────────────────────
    {"keywords": ["bread", "brot", "croissant", "muffin", "bagel",
                  "danish", "scone", "biscuit", "cookie"],
     "category": "food_baked", "carbon_kg": 0.55},
    # ── Dairy ──────────────────────────────────────────────────────────────────
    {"keywords": ["cheese", "käse", "brie", "cheddar", "parmesan",
                  "mozzarella", "gouda", "feta", "camembert"],
     "category": "food_dairy", "carbon_kg": 1.9},
    {"keywords": ["egg", "omelette", "omelet", "scrambled", "frittata",
                  "quiche", "eggs benedict"],
     "category": "food_dairy", "carbon_kg": 0.4},
    # ── Plant-based ────────────────────────────────────────────────────────────
    {"keywords": ["vegan", "vegetarian", "veggie", "tofu", "falafel",
                  "hummus", "lentil", "chickpea", "tempeh", "seitan"],
     "category": "food_vegetarian", "carbon_kg": 0.2},
    {"keywords": ["vegetable", "broccoli", "carrot", "spinach", "asparagus",
                  "mushroom", "onion", "tomato", "pepper", "courgette",
                  "zucchini", "aubergine", "eggplant"],
     "category": "food_vegetarian", "carbon_kg": 0.15},
    # ── Transport (road) ───────────────────────────────────────────────────────
    {"keywords": ["taxi", "cab"],
     "category": "transport_road", "carbon_kg": 0.21},
    {"keywords": ["uber", "lyft", "ola", "grab", "bolt", "rideshare"],
     "category": "transport_road", "carbon_kg": 0.17},
    {"keywords": ["bus", "coach"],
     "category": "transport_public", "carbon_kg": 0.09},
    {"keywords": ["train", "rail", "metro", "subway", "tube", "tram",
                  "bahn", "s-bahn", "u-bahn"],
     "category": "transport_public", "carbon_kg": 0.04},
    {"keywords": ["flight", "airline", "airways", "airfare", "plane ticket"],
     "category": "transport_air", "carbon_kg": 20.0},
    {"keywords": ["car rental", "vehicle hire", "rent a car", "hertz",
                  "avis", "enterprise car", "sixt", "europcar"],
     "category": "transport_road", "carbon_kg": 2.4},
    {"keywords": ["ferry", "boat", "cruise", "ship"],
     "category": "transport_water", "carbon_kg": 1.2},
    {"keywords": ["parking", "parkhaus", "car park"],
     "category": "transport_road", "carbon_kg": 0.05},
    # ── Fuel ───────────────────────────────────────────────────────────────────
    {"keywords": ["petrol", "gasoline", "gas station", "benzin"],
     "category": "fuel", "carbon_kg": 2.31},
    {"keywords": ["diesel"],
     "category": "fuel", "carbon_kg": 2.68},
    {"keywords": ["ev charging", "electric vehicle", "charging station"],
     "category": "fuel", "carbon_kg": 0.05},
    {"keywords": ["lpg", "cng", "natural gas"],
     "category": "fuel", "carbon_kg": 1.63},
    # ── Accommodation ──────────────────────────────────────────────────────────
    {"keywords": ["hotel", "motel", "resort", "hostel", "inn",
                  "berghotel", "lodge", "airbnb", "accommodation",
                  "bed and breakfast", "b&b"],
     "category": "accommodation", "carbon_kg": 1.5},
    {"keywords": ["room service", "minibar", "laundry service"],
     "category": "accommodation", "carbon_kg": 0.3},
    # ── Electronics ────────────────────────────────────────────────────────────
    {"keywords": ["laptop", "notebook pc", "macbook"],
     "category": "electronics", "carbon_kg": 300.0},
    {"keywords": ["smartphone", "iphone", "android phone", "mobile phone"],
     "category": "electronics", "carbon_kg": 70.0},
    {"keywords": ["tablet", "ipad"],
     "category": "electronics", "carbon_kg": 100.0},
    {"keywords": ["monitor", "screen", "display"],
     "category": "electronics", "carbon_kg": 200.0},
    {"keywords": ["printer", "ink cartridge", "toner"],
     "category": "office_supplies", "carbon_kg": 15.0},
    {"keywords": ["paper", "stationery", "pen", "pencil", "notebook"],
     "category": "office_supplies", "carbon_kg": 0.3},
    # ── Clothing ───────────────────────────────────────────────────────────────
    {"keywords": ["t-shirt", "shirt", "jeans", "trousers", "jacket",
                  "coat", "dress", "skirt", "clothing", "apparel",
                  "blouse", "sweater", "hoodie"],
     "category": "clothing", "carbon_kg": 5.0},
    {"keywords": ["shoes", "sneakers", "boots", "footwear", "sandals"],
     "category": "clothing", "carbon_kg": 7.0},
    # ── Grocery ────────────────────────────────────────────────────────────────
    {"keywords": ["fruit", "apple", "banana", "orange", "strawberry",
                  "grape", "mango", "pineapple"],
     "category": "grocery_fresh", "carbon_kg": 0.3},
    {"keywords": ["organic", "produce"],
     "category": "grocery_fresh", "carbon_kg": 0.4},
    {"keywords": ["grocery", "supermarket", "lidl", "aldi", "tesco",
                  "migros", "coop", "rewe"],
     "category": "grocery", "carbon_kg": 2.5},
    # ── Healthcare ─────────────────────────────────────────────────────────────
    {"keywords": ["pharmacy", "medicine", "prescription", "apotheke",
                  "drug store"],
     "category": "healthcare", "carbon_kg": 0.5},
    {"keywords": ["doctor", "hospital", "clinic", "medical", "dentist"],
     "category": "healthcare", "carbon_kg": 0.8},
]


# ─── Compile patterns once at import time ────────────────────────────────────

_COMPILED: List[Dict] = [
    {
        "patterns": [
            re.compile(re.escape(kw), re.IGNORECASE)
            for kw in entry["keywords"]
        ],
        "category": entry["category"],
        "carbon_kg": entry["carbon_kg"],
    }
    for entry in _KEYWORD_FACTORS
]


# ─── Public API ───────────────────────────────────────────────────────────────

def load_carbon_database() -> Dict:
    """Legacy exact-match dict (kept for backward compatibility)."""
    return {
        entry["keywords"][0]: {
            "category": entry["category"],
            "carbon_kg": entry["carbon_kg"],
        }
        for entry in _KEYWORD_FACTORS
    }


def _match_item(name: str) -> Dict:
    """Fuzzy keyword match – returns first hit or unknown fallback."""
    for entry in _COMPILED:
        for pat in entry["patterns"]:
            if pat.search(name):
                return {"category": entry["category"],
                        "carbon_kg": entry["carbon_kg"]}
    return {"category": "unknown", "carbon_kg": 0.0}


def calculate_receipt_carbon(items: List[Dict], carbon_db: Dict) -> Dict:
    """
    Map line items to carbon factors using fuzzy keyword matching.
    `carbon_db` is accepted for API compatibility but not used directly.
    """
    mapped = []
    total = 0.0
    for item in items:
        name = item.get("name", "").strip()
        factor = _match_item(name)
        c = float(factor["carbon_kg"])
        mapped.append({
            "name": name,
            "amount": item.get("amount", 0.0),
            "category": factor["category"],
            "carbon_kg": c,
        })
        total += c
    return {"total_carbon_kg": round(total, 4), "mapped_items": mapped}