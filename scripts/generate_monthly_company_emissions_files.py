from __future__ import annotations

import csv
import json
from datetime import date
from pathlib import Path

ORG_ID = "11111111-1111-1111-1111-111111111111"

EMPLOYEES = {
    "sarah": ("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "Sarah Chen", "Operations", "Mumbai"),
    "ravi": ("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", "Ravi Kumar", "Logistics", "Pune"),
    "anita": ("cccccccc-cccc-cccc-cccc-cccccccccccc", "Anita Shah", "Facilities", "Mumbai"),
    "vikram": ("dddddddd-dddd-dddd-dddd-dddddddddddd", "Vikram Patel", "Logistics", "Pune"),
    "priya": ("eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee", "Priya Desai", "HR", "Delhi"),
    "nikhil": ("ffffffff-ffff-ffff-ffff-ffffffffffff", "Nikhil Sharma", "Sales", "Bengaluru"),
    "meera": ("gggggggg-gggg-gggg-gggg-gggggggggggg", "Meera Nair", "Facilities", "Bangalore"),
    "arun": ("hhhhhhhh-hhhh-hhhh-hhhh-hhhhhhhhhhhh", "Arun Iyer", "Finance", "Chennai"),
    "divya": ("iiiiiiii-iiii-iiii-iiii-iiiiiiiiiiii", "Divya Verma", "Marketing", "Mumbai"),
    "sanjay": ("jjjjjjjj-jjjj-jjjj-jjjj-jjjjjjjjjjjj", "Sanjay Gupta", "Operations", "Mumbai"),
}

FIELDS = [
    "record_id",
    "organization_id",
    "employee_id",
    "employee_name",
    "department",
    "date",
    "source_category",
    "activity_type",
    "quantity",
    "unit",
    "spend_inr",
    "vendor",
    "location",
    "scope",
    "notes",
]

MONTHS = [
    (2025, 4),
    (2025, 5),
    (2025, 6),
    (2025, 7),
    (2025, 8),
    (2025, 9),
    (2025, 10),
    (2025, 11),
    (2025, 12),
    (2026, 1),
    (2026, 2),
    (2026, 3),
]

# Seasonal multipliers per month to keep values realistic (heat, travel cycles, festive demand).
ENERGY_MULTIPLIER = {4: 1.00, 5: 1.08, 6: 1.10, 7: 1.06, 8: 1.04, 9: 1.02, 10: 1.03, 11: 0.98, 12: 0.95, 1: 0.99, 2: 1.01, 3: 1.05}
TRAVEL_MULTIPLIER = {4: 0.98, 5: 1.00, 6: 1.03, 7: 0.96, 8: 1.01, 9: 1.04, 10: 1.09, 11: 1.12, 12: 1.10, 1: 1.00, 2: 1.02, 3: 1.06}
WASTE_MULTIPLIER = {4: 1.00, 5: 1.02, 6: 1.03, 7: 1.01, 8: 1.02, 9: 1.04, 10: 1.07, 11: 1.08, 12: 1.09, 1: 1.05, 2: 1.06, 3: 1.08}
PURCHASE_MULTIPLIER = {4: 0.96, 5: 1.00, 6: 1.02, 7: 1.01, 8: 1.03, 9: 1.05, 10: 1.11, 11: 1.15, 12: 1.20, 1: 1.02, 2: 1.04, 3: 1.08}
FOOD_MULTIPLIER = {4: 0.98, 5: 1.00, 6: 1.01, 7: 1.00, 8: 1.02, 9: 1.04, 10: 1.08, 11: 1.11, 12: 1.14, 1: 1.03, 2: 1.05, 3: 1.07}

BASE = {
    "energy_mumbai": 1120,
    "energy_delhi": 520,
    "energy_bangalore": 760,
    "diesel_liter": 255,
    "petrol_liter": 92,
    "cng_kg": 84,
    "flight_sales": 1380,
    "flight_logistics": 920,
    "rail_km": 360,
    "bus_km": 280,
    "landfill_kg": 505,
    "recycled_kg": 355,
    "paper_kg": 168,
    "purchases_finance": 158000,
    "purchases_ops": 118000,
    "hotel_night": 5,
    "food_canteen": 98000,
    "food_pantry": 26000,
}


def round_to_step(value: float, step: int) -> int:
    return int(round(value / step) * step)


def row(
    record_id: str,
    person_key: str,
    d: date,
    source_category: str,
    activity_type: str,
    quantity: float,
    unit: str,
    spend_inr: float,
    vendor: str,
    location: str,
    scope: str,
    notes: str,
) -> dict[str, str]:
    employee_id, employee_name, department, default_location = EMPLOYEES[person_key]
    out_location = location or default_location
    return {
        "record_id": record_id,
        "organization_id": ORG_ID,
        "employee_id": employee_id,
        "employee_name": employee_name,
        "department": department,
        "date": d.isoformat(),
        "source_category": source_category,
        "activity_type": activity_type,
        "quantity": f"{quantity:.0f}" if float(quantity).is_integer() else f"{quantity:.2f}",
        "unit": unit,
        "spend_inr": f"{spend_inr:.0f}" if float(spend_inr).is_integer() else f"{spend_inr:.2f}",
        "vendor": vendor,
        "location": out_location,
        "scope": scope,
        "notes": notes,
    }


def generate_month_rows(year: int, month: int) -> list[dict[str, str]]:
    month_index = (year - 2025) * 12 + (month - 4)

    growth = 1.0 + (0.022 * month_index)  # steady growth in business activity

    e_mult = ENERGY_MULTIPLIER[month] * growth
    t_mult = TRAVEL_MULTIPLIER[month] * growth
    w_mult = WASTE_MULTIPLIER[month] * growth
    p_mult = PURCHASE_MULTIPLIER[month] * growth
    f_mult = FOOD_MULTIPLIER[month] * growth

    yymm = f"{year}{month:02d}"
    d1 = date(year, month, 3)
    d2 = date(year, month, 8)
    d3 = date(year, month, 12)
    d4 = date(year, month, 17)
    d5 = date(year, month, 22)
    d6 = date(year, month, 26)

    rows = [
        row(f"m-{yymm}-001", "sarah", d1, "Energy", "electricity_grid_kwh", round_to_step(BASE["energy_mumbai"] * e_mult, 5), "kWh", 0, "State Grid", "Mumbai", "Scope 2", "Main Mumbai office electricity usage"),
        row(f"m-{yymm}-002", "priya", d1, "Energy", "electricity_grid_kwh", round_to_step(BASE["energy_delhi"] * e_mult, 2), "kWh", 0, "State Grid", "Delhi", "Scope 2", "Delhi branch electricity usage"),
        row(f"m-{yymm}-003", "meera", d1, "Energy", "electricity_grid_kwh", round_to_step(BASE["energy_bangalore"] * e_mult, 5), "kWh", 0, "State Grid", "Bangalore", "Scope 2", "Bangalore facility electricity usage"),
        row(f"m-{yymm}-004", "ravi", d2, "Transport", "diesel_liter", round_to_step(BASE["diesel_liter"] * t_mult, 1), "liter", 0, "HP Fuel", "Pune", "Scope 1", "Fleet diesel consumption for logistics movement"),
        row(f"m-{yymm}-005", "sanjay", d2, "Transport", "petrol_liter", round_to_step(BASE["petrol_liter"] * t_mult, 1), "liter", 0, "Shell", "Mumbai", "Scope 1", "Company pool vehicles petrol usage"),
        row(f"m-{yymm}-006", "vikram", d2, "Transport", "cng_kg", round_to_step(BASE["cng_kg"] * t_mult, 1), "kg", 0, "Mahanagar Gas", "Pune", "Scope 1", "CNG forklifts and short-haul vans"),
        row(f"m-{yymm}-007", "nikhil", d3, "Transport", "flight_km_economy", round_to_step(BASE["flight_sales"] * t_mult, 10), "km", 0, "IndiGo", "Bengaluru", "Scope 3", "Sales client travel economy class"),
        row(f"m-{yymm}-008", "vikram", d3, "Transport", "flight_km_economy", round_to_step(BASE["flight_logistics"] * t_mult, 10), "km", 0, "IndiGo", "Delhi", "Scope 3", "Logistics coordination travel economy class"),
        row(f"m-{yymm}-009", "priya", d3, "Transport", "rail_km", round_to_step(BASE["rail_km"] * t_mult, 5), "km", 0, "Indian Railways", "Mumbai", "Scope 3", "Intercity conference rail travel"),
        row(f"m-{yymm}-010", "divya", d3, "Transport", "bus_km", round_to_step(BASE["bus_km"] * t_mult, 5), "km", 0, "Intercity Bus Service", "Mumbai", "Scope 3", "Regional marketing events by bus"),
        row(f"m-{yymm}-011", "anita", d4, "Waste", "landfill_waste_kg", round_to_step(BASE["landfill_kg"] * w_mult, 2), "kg", 0, "City Waste Management", "Mumbai", "Scope 3", "Mixed office waste to landfill"),
        row(f"m-{yymm}-012", "meera", d4, "Waste", "recycled_waste_kg", round_to_step(BASE["recycled_kg"] * w_mult, 2), "kg", 0, "Recycler Co", "Bangalore", "Scope 3", "Segregated recyclables dispatched"),
        row(f"m-{yymm}-013", "anita", d4, "Waste", "paper_kg", round_to_step(BASE["paper_kg"] * w_mult, 1), "kg", 0, "Paper Vendor", "Mumbai", "Scope 3", "Paper consumption equivalent"),
        row(f"m-{yymm}-014", "arun", d5, "Purchases", "purchased_goods_inr", round_to_step(BASE["purchases_finance"] * p_mult, 500), "INR", round_to_step(BASE["purchases_finance"] * p_mult, 500), "Supplier B", "Chennai", "Scope 3", "IT, finance and office equipment procurement"),
        row(f"m-{yymm}-015", "sarah", d5, "Purchases", "purchased_goods_inr", round_to_step(BASE["purchases_ops"] * p_mult, 500), "INR", round_to_step(BASE["purchases_ops"] * p_mult, 500), "Supplier A", "Mumbai", "Scope 3", "Operations consumables and maintenance purchases"),
        row(f"m-{yymm}-016", "divya", d6, "Purchases", "hotel_night", round_to_step(BASE["hotel_night"] * t_mult, 1), "night", 0, "Hotel Group", "Mumbai", "Scope 3", "Employee accommodation for events and meetings"),
        row(f"m-{yymm}-017", "priya", d6, "Food", "purchased_goods_inr", round_to_step(BASE["food_canteen"] * f_mult, 500), "INR", round_to_step(BASE["food_canteen"] * f_mult, 500), "FreshMenu Corporate", "Mumbai", "Scope 3", "Employee cafeteria and catered meals"),
        row(f"m-{yymm}-018", "anita", d6, "Food", "purchased_goods_inr", round_to_step(BASE["food_pantry"] * f_mult, 100), "INR", round_to_step(BASE["food_pantry"] * f_mult, 100), "Metro Cash and Carry", "Mumbai", "Scope 3", "Pantry supplies snacks and beverages"),
    ]

    return rows


def write_csv(path: Path, rows: list[dict[str, str]], delimiter: str = ",") -> None:
    with path.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=FIELDS, delimiter=delimiter)
        writer.writeheader()
        writer.writerows(rows)


def write_json(path: Path, rows: list[dict[str, str]]) -> None:
    with path.open("w", encoding="utf-8") as f:
        json.dump(rows, f, ensure_ascii=True, indent=2)


def main() -> None:
    out_dir = Path("data/raw/sample_org_data/monthly_emissions_bulk_12m")
    out_dir.mkdir(parents=True, exist_ok=True)

    format_cycle = ["csv", "tsv", "json"]

    for idx, (year, month) in enumerate(MONTHS):
        rows = generate_month_rows(year, month)
        fmt = format_cycle[idx % len(format_cycle)]
        stem = f"company_emissions_{year}_{month:02d}"

        if fmt == "csv":
            write_csv(out_dir / f"{stem}.csv", rows, delimiter=",")
        elif fmt == "tsv":
            write_csv(out_dir / f"{stem}.tsv", rows, delimiter="\t")
        else:
            write_json(out_dir / f"{stem}.json", rows)

    print(f"Generated 12 monthly files in: {out_dir}")


if __name__ == "__main__":
    main()
