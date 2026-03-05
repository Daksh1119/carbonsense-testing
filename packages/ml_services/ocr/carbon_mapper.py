from typing import List, Dict


def load_carbon_database() -> Dict:
    # Replace with Supabase/table-backed factors if needed
    return {
        "biryani": {"category": "food", "carbon_kg": 1.2},
        "diesel": {"category": "transport", "carbon_kg": 2.6},
        "flight": {"category": "transport", "carbon_kg": 20.0},
    }


def calculate_receipt_carbon(items: List[Dict], carbon_db: Dict) -> Dict:
    mapped = []
    total = 0.0
    for item in items:
        name = item.get("name", "").strip().lower()
        factor = carbon_db.get(name, {"category": "unknown", "carbon_kg": 0.0})
        c = float(factor["carbon_kg"])
        mapped.append({
            "name": item.get("name", ""),
            "category": factor["category"],
            "carbon_kg": c,
        })
        total += c
    return {"total_carbon_kg": round(total, 4), "mapped_items": mapped}