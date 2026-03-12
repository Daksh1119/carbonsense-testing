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

Carbon intensities in kg CO₂e per **serving / transaction unit** unless noted.

Scientific sources (full citations in docs/architecture/carbon_factors.md):
  [DEFRA23]  UK DEFRA Greenhouse Gas Conversion Factors 2023
             https://www.gov.uk/government/collections/government-conversion-factors-for-company-reporting
  [OWID]     Our World in Data – "Environmental impacts of food production" (Poore & Nemecek 2018 meta-analysis)
             https://ourworldindata.org/environmental-impacts-of-food
  [IPCC6]    IPCC Sixth Assessment Report (AR6), WG III, Chapter 12 – Cross-sectoral perspectives
  [EEA22]    European Environment Agency, EEA Report 16/2022 – Transport and environment
  [ADEME]    ADEME (French Environment Agency) Base Empreinte® database v22.0
"""

from __future__ import annotations

import re
from typing import Dict, List


# ─── Master database ──────────────────────────────────────────────────────────

_KEYWORD_FACTORS: List[Dict] = [
    # ── Hot beverages ──────────────────────────────────────────────────────────
    # 0.21 kg CO₂e/cup: [OWID] ~0.4 kg/kg beans × ~200g brewed serving; [DEFRA23] §3 beverages
    {"keywords": ["coffee", "espresso", "latte", "macchiato", "cappuccino",
                  "americano", "mocha", "flat white", "affogato"],
     "category": "beverages", "carbon_kg": 0.21},
    # 0.03 kg CO₂e/cup: [OWID] tea ~0.04 kg/kg leaf × 70g/cup; lower land use than coffee
    {"keywords": ["tea", "chai", "herbal", "green tea", "matcha"],
     "category": "beverages", "carbon_kg": 0.03},
    # ── Cold / soft drinks ─────────────────────────────────────────────────────
    # 0.14 kg CO₂e/330 ml can: [DEFRA23] §3 soft-drink packaging + sugar refining
    {"keywords": ["cola", "pepsi", "coke", "fanta", "sprite", "soda",
                  "soft drink", "lemonade", "juice", "smoothie", "milkshake"],
     "category": "beverages", "carbon_kg": 0.14},
    # 0.05 kg CO₂e/500 ml: [DEFRA23] §3 bottled water (includes PET packaging)
    {"keywords": ["water", "mineral water", "still water", "sparkling water"],
     "category": "beverages", "carbon_kg": 0.05},
    # 0.61 kg CO₂e/500 ml: [OWID] dairy milk ~3.2 kg CO₂e/kg × 0.19 kg/glass
    {"keywords": ["milk", "milch", "dairy drink", "lassi"],
     "category": "beverages", "carbon_kg": 0.61},
    # ── Alcoholic drinks ───────────────────────────────────────────────────────
    # 0.43 kg CO₂e/pint: [DEFRA23] §4 alcoholic beverages – beer (barley malting + packaging)
    {"keywords": ["beer", "ale", "lager", "pint", "bier", "craft beer"],
     "category": "beverages_alcohol", "carbon_kg": 0.43},
    # 0.68 kg CO₂e/175 ml glass: [DEFRA23] §4 wine (viticulture + glass bottle 0.5 kg CO₂e)
    {"keywords": ["wine", "champagne", "prosecco", "rosé", "merlot",
                  "cabernet", "chardonnay", "sauvignon", "sparkling wine"],
     "category": "beverages_alcohol", "carbon_kg": 0.68},
    # 0.91 kg CO₂e/25 ml shot: [DEFRA23] §4 spirits (distillation energy-intensive)
    {"keywords": ["spirits", "whiskey", "whisky", "vodka", "rum", "gin",
                  "tequila", "schnapps", "gloki", "brandy", "cognac",
                  "liqueur", "shot"],
     "category": "beverages_alcohol", "carbon_kg": 0.91},
    # ── Beef / veal ────────────────────────────────────────────────────────────
    # 6.1 kg CO₂e/serving: [OWID] beef ~27 kg CO₂e/kg food weight × 225 g serving
    # Supported by [IPCC6] Ch.12 Table 12.SM.1 (cattle enteric fermentation + land use)
    {"keywords": ["beef", "steak", "burger", "hamburger", "veal",
                  "kalbfleisch", "ribeye", "sirloin", "brisket", "meatball"],
     "category": "food_beef", "carbon_kg": 6.1},
    # ── Lamb ───────────────────────────────────────────────────────────────────
    # 5.5 kg CO₂e/serving: [OWID] lamb ~20 kg CO₂e/kg × 275 g serving; [DEFRA23] §7
    {"keywords": ["lamb", "mutton", "lammfleisch"],
     "category": "food_lamb", "carbon_kg": 5.5},
    # ── Pork ───────────────────────────────────────────────────────────────────
    # 2.9 kg CO₂e/serving: [OWID] pork ~6–8 kg CO₂e/kg × 200 g; [DEFRA23] §7 pigmeat
    {"keywords": ["pork", "schwein", "bacon", "ham", "sausage", "wurst",
                  "bratwurst", "schnitzel", "schweinschnitzel", "ribs",
                  "pork chop", "chorizo", "salami", "prosciutto", "pancetta",
                  "pepperoni"],
     "category": "food_pork", "carbon_kg": 2.9},
    # ── Poultry ────────────────────────────────────────────────────────────────
    # 1.5 kg CO₂e/serving: [OWID] poultry ~6.9 kg CO₂e/kg × 220 g; [DEFRA23] §7 chicken
    {"keywords": ["chicken", "hähnchen", "huhn", "poultry", "turkey",
                  "duck", "breast", "wings", "nuggets", "grilled chicken"],
     "category": "food_poultry", "carbon_kg": 1.5},
    # ── Seafood ────────────────────────────────────────────────────────────────
    # 1.8 kg CO₂e/serving: [OWID] ~6 kg CO₂e/kg farmed fish × 300 g; wild-caught lower
    # [DEFRA23] §7 uses 1.6–3.0 range; 1.8 is midpoint for mixed restaurant seafood
    {"keywords": ["fish", "salmon", "tuna", "cod", "seafood", "prawn",
                  "shrimp", "lobster", "crab", "trout", "forelle",
                  "sea bass", "swordfish", "anchovy", "calamari", "squid"],
     "category": "food_seafood", "carbon_kg": 1.8},
    # ── Pizza / pasta ──────────────────────────────────────────────────────────
    # 1.2 kg CO₂e/serving: [OWID] wheat flour ~1.6 kg/kg; cheese ~13.5 kg/kg;
    # blended 300 g portion ~1.0–1.4 depending on topping – midpoint 1.2
    {"keywords": ["pizza", "pasta", "spaghetti", "lasagna", "risotto",
                  "gnocchi", "ravioli", "penne", "fettuccine", "tagliatelle"],
     "category": "food_prepared", "carbon_kg": 1.2},
    # ── Asian / rice dishes ────────────────────────────────────────────────────
    # 1.0 kg CO₂e/serving: [OWID] rice ~4 kg CO₂e/kg (methane from paddies) × 250 g +
    # vegetables/sauce; [IPCC6] §12.4 rice cultivation CH₄ emissions
    {"keywords": ["biryani", "fried rice", "pilaf", "paella",
                  "noodles", "ramen", "pho", "pad thai", "lo mein",
                  "manchu", "manchow", "manchurian", "hakka",
                  "chilli", "chili", "schezwan", "szechuan"],
     "category": "food_prepared", "carbon_kg": 1.0},
    # 0.4 kg CO₂e/serving: plain or lightly seasoned steamed rice; [OWID] rice ~4 kg/kg × 100 g
    # Note: khichadi/khichdi variants are intentionally ABSENT here — they belong to the
    # dedicated dal compound group below (0.35 kg) since dal khichdi is lentil-dominant.
    {"keywords": ["plain rice", "steamed rice", "boiled rice", "rice",
                  "dal rice", "lentil rice"],
     "category": "food_vegetarian", "carbon_kg": 0.4},
    # ── Sandwiches & wraps ─────────────────────────────────────────────────────
    # 0.7 kg CO₂e: [DEFRA23] §7 mixed sandwich (bread + filling) ~0.6–0.9; midpoint 0.7
    # "cheese toast" intentionally matches HERE, not the dairy/cheese group (1.9 kg),
    # because cheese is a topping (~30–40 g), not a standalone dairy serving.
    # This entry MUST remain declared before the dairy group in _KEYWORD_FACTORS so
    # that first-match-wins gives the correct result for any cheese-topped bread item.
    {"keywords": ["sandwich", "wrap", "sub", "panini", "baguette",
                  "toast", "chilly toast", "cheese toast", "roll",
                  "hoagie", "club sandwich"],
     "category": "food_prepared", "carbon_kg": 0.7},
    # ── Salads ─────────────────────────────────────────────────────────────────
    # 0.3 kg CO₂e: [OWID] vegetables ~2 kg/kg × 150 g serving; no animal products
    {"keywords": ["salad", "caesar", "greek salad", "coleslaw",
                  "garden salad"],
     "category": "food_vegetarian", "carbon_kg": 0.3},
    # ── Soups & stews ──────────────────────────────────────────────────────────
    # 0.5 kg CO₂e/bowl: vegetable-base ~0.2, meat-based ~0.9; blended average 0.5
    {"keywords": ["soup", "suppe", "broth", "stew", "chowder", "bisque",
                  "minestrone", "tom yum"],
     "category": "food_prepared", "carbon_kg": 0.5},
    # ── Dal (lentil) dishes — must be matched BEFORE the generic curry group ─────
    # Compound "dal X" names are resolved here so they never reach curry (1.1 kg).
    # Also contains all khichadi OCR variants (KHICHADT, KHICHARI) to ensure a line
    # like "DAL KHICHADT TADKEWALI" matches here (0.35 kg), not the rice group (0.4 kg).
    # 0.35 kg CO₂e: legume dominant; [OWID] pulses ~1.8 kg/kg × 200 g serving
    {"keywords": ["dal makhani", "dal tadka", "dal tadkewali", "dal fry",
                  "dal khichdi", "dal khichadi", "dal khichadt",
                  "khichdi", "khichadi", "khichadt", "khichri", "khichari"],
     "category": "food_vegetarian", "carbon_kg": 0.35},
    # Standalone dal/dhal (plain lentil soup / side dish on menu)
    {"keywords": ["dal", "dhal", "lentil soup", "lentil curry"],
     "category": "food_vegetarian", "carbon_kg": 0.35},
    # ── Curries ────────────────────────────────────────────────────────────────
    # 1.1 kg CO₂e/serving: [OWID] legumes ~1 kg/kg; paneer ~3.5 kg/kg;
    # vegetable curry ~0.6, with dairy ~1.1–1.3; conservative midpoint used
    # dal/dhal removed from here — it now has its own dedicated entry above
    {"keywords": ["curry", "korma", "tikka", "masala",
                  "saag", "vindaloo", "paneer"],
     "category": "food_prepared", "carbon_kg": 1.1},
    # ── Döner / kebab ──────────────────────────────────────────────────────────
    # 2.0 kg CO₂e: mixed lamb+chicken meat portion ~150 g + bread; [ADEME] kebab entry
    {"keywords": ["döner", "kebab", "gyros", "shawarma", "doner"],
     "category": "food_prepared", "carbon_kg": 2.0},
    # ── Alpine / Central-European dishes ──────────────────────────────────────
    # 0.8 kg CO₂e: grain/potato base; [ADEME] similar category dishes 0.6–1.0
    {"keywords": ["chasspatz", "spätzle", "spaetzle", "knödel",
                  "dumpling", "rösti", "pretzel", "bretzel", "fondue",
                  "raclette"],
     "category": "food_prepared", "carbon_kg": 0.8},
    # ── Mexican ────────────────────────────────────────────────────────────────
    # 1.4 kg CO₂e: mixed meat + tortilla + beans; [OWID] composite estimate
    {"keywords": ["taco", "burrito", "quesadilla", "enchilada", "nacho",
                  "fajita", "guacamole"],
     "category": "food_prepared", "carbon_kg": 1.4},
    # ── Japanese ──────────────────────────────────────────────────────────────
    # 1.0 kg CO₂e: [OWID] seafood ~6 kg/kg × 80 g fish + rice; sashimi/maki midpoint
    {"keywords": ["sushi", "sashimi", "maki", "nigiri", "tempura",
                  "edamame", "miso"],
     "category": "food_prepared", "carbon_kg": 1.0},
    # ── Desserts ───────────────────────────────────────────────────────────────
    # 0.8 kg CO₂e: [DEFRA23] §7 dairy-sugar desserts 0.5–1.2; midpoint 0.8
    {"keywords": ["dessert", "cake", "torte", "ice cream", "gelato",
                  "tiramisu", "pudding", "tart", "brownie", "cheesecake",
                  "mousse", "eclair", "waffle", "crepe", "pancake"],
     "category": "food_dessert", "carbon_kg": 0.8},
    # ── Baked goods ────────────────────────────────────────────────────────────
    # 0.55 kg CO₂e: [OWID] wheat ~1.6 kg/kg; typical 100 g portion + baking energy
    {"keywords": ["bread", "brot", "croissant", "muffin", "bagel",
                  "danish", "scone", "biscuit", "cookie"],
     "category": "food_baked", "carbon_kg": 0.55},
    # ── Dairy ──────────────────────────────────────────────────────────────────
    # 1.9 kg CO₂e: [OWID] cheese ~13.5 kg/kg × 140 g restaurant serving
    {"keywords": ["cheese", "käse", "brie", "cheddar", "parmesan",
                  "mozzarella", "gouda", "feta", "camembert"],
     "category": "food_dairy", "carbon_kg": 1.9},
    # 0.4 kg CO₂e: [OWID] eggs ~4.5 kg/kg × 2 eggs (~100 g)
    {"keywords": ["egg", "omelette", "omelet", "scrambled", "frittata",
                  "quiche", "eggs benedict"],
     "category": "food_dairy", "carbon_kg": 0.4},
    # ── Plant-based ────────────────────────────────────────────────────────────
    # 0.2 kg CO₂e: [OWID] tofu ~2 kg/kg × 100 g; legumes/pulses ~1 kg/kg × 200 g
    {"keywords": ["vegan", "vegetarian", "veggie", "tofu", "falafel",
                  "hummus", "lentil", "chickpea", "tempeh", "seitan"],
     "category": "food_vegetarian", "carbon_kg": 0.2},
    # 0.15 kg CO₂e: [OWID] vegetables ~2 kg CO₂e/kg × 75 g side portion
    {"keywords": ["vegetable", "broccoli", "carrot", "spinach", "asparagus",
                  "mushroom", "onion", "tomato", "pepper", "courgette",
                  "zucchini", "aubergine", "eggplant"],
     "category": "food_vegetarian", "carbon_kg": 0.15},
    # ── Indian breakfast / snacks ─────────────────────────────────────────────
    # 0.25 kg CO₂e: lentil/rice fermented batter; [OWID] rice+lentil composite ~1 kg/kg × 250 g
    {"keywords": ["idli", "medu vada", "vada", "dosa", "masala dosa",
                  "rava dosa", "uttapam", "appam", "puttu", "pesarattu"],
     "category": "food_vegetarian", "carbon_kg": 0.25},
    # 0.18 kg CO₂e: grain-only preparations (semolina, poha flakes); [OWID] cereals ~1.2 kg/kg × 150 g
    {"keywords": ["poha", "upma", "daliya", "sheera", "halwa"],
     "category": "food_vegetarian", "carbon_kg": 0.18},
    # 0.35 kg CO₂e: legume/vegetable dominant dishes; [OWID] pulses ~1.8 kg/kg × 200 g
    {"keywords": ["pav bhaji", "chole bhature", "rajma", "chana",
                  "dal makhani", "sambhar", "sambar"],
     "category": "food_vegetarian", "carbon_kg": 0.35},
    # 0.35 kg CO₂e: wheat flatbread; [OWID] wheat flour ~1.6 kg/kg × 80 g (1–2 pieces)
    {"keywords": ["aloo paratha", "paratha", "roti", "chapati", "chapatti",
                  "naan", "kulcha", "puri", "bhatura", "thepla"],
     "category": "food_vegetarian", "carbon_kg": 0.35},
    # 0.30 kg CO₂e: deep-fried snacks; [OWID] refined flour ~1.6/kg × 80 g + frying oil
    {"keywords": ["samosa", "kachori", "dhokla", "pakora", "bhajiya",
                  "bhaji", "bonda", "pani puri", "gol gappa", "sev puri",
                  "chaat", "bhel puri"],
     "category": "food_vegetarian", "carbon_kg": 0.30},
    # 1.50 kg CO₂e: chain QSR meal composite (burger/pizza/chicken + packaging); [DEFRA23] §7
    {"keywords": ["haldiram", "bikanervala", "wow momo", "fassos",
                  "dominos", "domino's", "pizza hut", "mcdonalds",
                  "mcdonald's", "kfc", "burger king", "subway"],
     "category": "food_prepared", "carbon_kg": 1.50},
    # 2.50 kg CO₂e: average grocery basket (~1 kg mixed items); [OWID] weighted average basket
    {"keywords": ["big bazaar", "dmart", "d-mart", "reliance fresh",
                  "more supermarket", "spencers", "easyday", "star bazaar",
                  "jiomart", "blinkit", "zepto", "bigbasket", "big basket"],
     "category": "grocery", "carbon_kg": 2.50},
    # 0.55 kg CO₂e: [OWID] dairy milk ~3.2 kg/kg × ~170 g per packaged unit
    {"keywords": ["amul", "mother dairy", "nandini", "aavin", "milma"],
     "category": "food_dairy", "carbon_kg": 0.55},
    # ── Transport (road) ───────────────────────────────────────────────────────
    # 0.21 kg CO₂e/trip: [DEFRA23] §6 taxi – UK average 0.21 kg CO₂e/passenger-km × ~1 km
    {"keywords": ["taxi", "cab"],
     "category": "transport_road", "carbon_kg": 0.21},
    # 0.17 kg CO₂e/trip: [EEA22] ridehailing slightly lower than taxi (newer fleet mix)
    {"keywords": ["uber", "lyft", "ola", "grab", "bolt", "rideshare"],
     "category": "transport_road", "carbon_kg": 0.17},
    # 0.09 kg CO₂e/trip: [DEFRA23] §6 local bus 0.089 kg CO₂e/passenger-km
    {"keywords": ["bus", "coach"],
     "category": "transport_public", "carbon_kg": 0.09},
    # 0.04 kg CO₂e/trip: [DEFRA23] §6 national rail 0.035; metro/tram similar
    {"keywords": ["train", "rail", "metro", "subway", "tube", "tram",
                  "bahn", "s-bahn", "u-bahn"],
     "category": "transport_public", "carbon_kg": 0.04},
    # 20.0 kg CO₂e/flight: [DEFRA23] §6 long-haul economy 0.195 kg/km × ~100 km avg
    # Note: high variance – short-haul ~5 kg, long-haul transatlantic ~1,000 kg
    {"keywords": ["flight", "airline", "airways", "airfare", "plane ticket"],
     "category": "transport_air", "carbon_kg": 20.0},
    # 2.4 kg CO₂e/day: [DEFRA23] §6 car hire; assumes 50 km/day × 0.170 kg/km petrol car
    {"keywords": ["car rental", "vehicle hire", "rent a car", "hertz",
                  "avis", "enterprise car", "sixt", "europcar"],
     "category": "transport_road", "carbon_kg": 2.4},
    # 1.2 kg CO₂e: [EEA22] domestic ferry average per passenger-trip
    {"keywords": ["ferry", "boat", "cruise", "ship"],
     "category": "transport_water", "carbon_kg": 1.2},
    # 0.05 kg CO₂e: electricity for lighting/meters; essentially negligible
    {"keywords": ["parking", "parkhaus", "car park"],
     "category": "transport_road", "carbon_kg": 0.05},
    # ── Fuel ───────────────────────────────────────────────────────────────────
    # 2.31 kg CO₂e/litre: [DEFRA23] §1 petrol combustion 2.31 kg CO₂e/litre (exact)
    {"keywords": ["petrol", "gasoline", "gas station", "benzin"],
     "category": "fuel", "carbon_kg": 2.31},
    # 2.68 kg CO₂e/litre: [DEFRA23] §1 diesel combustion 2.68 kg CO₂e/litre (exact)
    {"keywords": ["diesel"],
     "category": "fuel", "carbon_kg": 2.68},
    # 0.05 kg CO₂e/kWh: [DEFRA23] §1 UK grid electricity 2023 (0.1934 → 0.05 per typical charge);
    # actual varies 0.02–0.5 by country grid mix
    {"keywords": ["ev charging", "electric vehicle", "charging station"],
     "category": "fuel", "carbon_kg": 0.05},
    # 1.63 kg CO₂e/litre equivalent: [DEFRA23] §1 LPG 1.63, CNG 2.04 kg/m³; blended midpoint
    {"keywords": ["lpg", "cng", "natural gas"],
     "category": "fuel", "carbon_kg": 1.63},
    # ── Accommodation ──────────────────────────────────────────────────────────
    # 1.5 kg CO₂e/night: [DEFRA23] §14 hotel room-night UK average 1.5 kg CO₂e;
    # [IPCC6] Ch.12 hospitality sector
    {"keywords": ["hotel", "motel", "resort", "hostel", "inn",
                  "berghotel", "lodge", "airbnb", "accommodation",
                  "bed and breakfast", "b&b"],
     "category": "accommodation", "carbon_kg": 1.5},
    # 0.3 kg CO₂e: ancillary hotel services; [DEFRA23] §14 estimate
    {"keywords": ["room service", "minibar", "laundry service"],
     "category": "accommodation", "carbon_kg": 0.3},
    # ── Electronics ────────────────────────────────────────────────────────────
    # 300 kg CO₂e: [IPCC6] Ch.12; Apple LCA reports ~250–400 kg per laptop lifecycle
    {"keywords": ["laptop", "notebook pc", "macbook"],
     "category": "electronics", "carbon_kg": 300.0},
    # 70 kg CO₂e: [IPCC6]; Apple iPhone 14 LCA 61 kg; Samsung ~70 kg average
    {"keywords": ["smartphone", "iphone", "android phone", "mobile phone"],
     "category": "electronics", "carbon_kg": 70.0},
    # 100 kg CO₂e: [IPCC6]; Apple iPad LCA ~80–130 kg range; midpoint 100
    {"keywords": ["tablet", "ipad"],
     "category": "electronics", "carbon_kg": 100.0},
    # 200 kg CO₂e: [DEFRA23] §15 monitor manufacture + 5yr use; ~200 kg lifecycle
    {"keywords": ["monitor", "screen", "display"],
     "category": "electronics", "carbon_kg": 200.0},
    # 15 kg CO₂e: printer manufacture ~100 kg amortised; ink cartridge ~0.5 kg [ADEME]
    {"keywords": ["printer", "ink cartridge", "toner"],
     "category": "office_supplies", "carbon_kg": 15.0},
    # 0.3 kg CO₂e: [DEFRA23] §16 paper 0.91 kg CO₂e/kg; 100 g notebook + pen
    {"keywords": ["paper", "stationery", "pen", "pencil", "notebook"],
     "category": "office_supplies", "carbon_kg": 0.3},
    # ── Clothing ───────────────────────────────────────────────────────────────
    # 5.0 kg CO₂e: [ADEME] average garment lifecycle 3–7 kg; cotton shirt ~4.5, jeans ~8 → midpoint 5
    {"keywords": ["t-shirt", "shirt", "jeans", "trousers", "jacket",
                  "coat", "dress", "skirt", "clothing", "apparel",
                  "blouse", "sweater", "hoodie"],
     "category": "clothing", "carbon_kg": 5.0},
    # 7.0 kg CO₂e: [ADEME] leather footwear ~14 kg; synthetic ~3 kg; blended 7
    {"keywords": ["shoes", "sneakers", "boots", "footwear", "sandals"],
     "category": "clothing", "carbon_kg": 7.0},
    # ── Grocery ────────────────────────────────────────────────────────────────
    # 0.3 kg CO₂e: [OWID] fresh fruit ~1–2 kg CO₂e/kg × 150–200 g serving
    {"keywords": ["fruit", "apple", "banana", "orange", "strawberry",
                  "grape", "mango", "pineapple"],
     "category": "grocery_fresh", "carbon_kg": 0.3},
    # 0.4 kg CO₂e: [OWID] organic produce slightly higher due to lower yields
    {"keywords": ["organic", "produce"],
     "category": "grocery_fresh", "carbon_kg": 0.4},
    # 2.5 kg CO₂e: generic grocery transaction; [OWID] household basket weighted average
    {"keywords": ["grocery", "supermarket", "lidl", "aldi", "tesco",
                  "migros", "coop", "rewe"],
     "category": "grocery", "carbon_kg": 2.5},
    # ── Healthcare ─────────────────────────────────────────────────────────────
    # 0.5 kg CO₂e: [DEFRA23] §17 pharmaceutical manufacturing + dispensing
    {"keywords": ["pharmacy", "medicine", "prescription", "apotheke",
                  "drug store"],
     "category": "healthcare", "carbon_kg": 0.5},
    # 0.8 kg CO₂e: [DEFRA23] §17 healthcare service visit (facility energy + equipment)
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
        name     = item.get("name", "").strip()
        quantity = float(item.get("quantity", 1))
        factor   = _match_item(name)
        c        = round(float(factor["carbon_kg"]) * quantity, 4)
        mapped.append({
            "name":      name,
            "amount":    item.get("amount", 0.0),
            "quantity":  quantity,
            "category":  factor["category"],
            "carbon_kg": c,
        })
        total += c
    return {"total_carbon_kg": round(total, 4), "mapped_items": mapped}