import csv
import io
import re
from datetime import date
from dataclasses import dataclass
from typing import Any, Dict, List, Tuple


# Core accounting equation per GHG Protocol Corporate Standard:
# Emissions (kgCO2e) = Activity Data x Emission Factor
# Factors below are defaults for demo/prototyping and should be versioned per region/year.
EMISSION_FACTORS_KGCO2E: Dict[str, Dict[str, Any]] = {
    "electricity_grid_kwh": {"factor": 0.708, "source": "India CEA grid baseline (indicative)", "scope": "Scope 2"},
    "diesel_liter": {"factor": 2.68, "source": "IPCC/EPA fuel combustion defaults", "scope": "Scope 1"},
    "petrol_liter": {"factor": 2.31, "source": "IPCC/EPA fuel combustion defaults", "scope": "Scope 1"},
    "cng_kg": {"factor": 2.75, "source": "IPCC/EPA fuel combustion defaults", "scope": "Scope 1"},
    "flight_km_economy": {"factor": 0.15, "source": "DEFRA distance-based aviation factors (indicative)", "scope": "Scope 3"},
    "rail_km": {"factor": 0.035, "source": "DEFRA rail passenger factors (indicative)", "scope": "Scope 3"},
    "bus_km": {"factor": 0.089, "source": "DEFRA bus factors (indicative)", "scope": "Scope 3"},
    "landfill_waste_kg": {"factor": 0.57, "source": "EPA WARM/DEFRA waste defaults (indicative)", "scope": "Scope 3"},
    "recycled_waste_kg": {"factor": 0.02, "source": "EPA WARM recycling defaults (indicative)", "scope": "Scope 3"},
    "paper_kg": {"factor": 0.94, "source": "DEFRA material factor (indicative)", "scope": "Scope 3"},
    "hotel_night": {"factor": 15.0, "source": "Hotel stay intensity benchmark (indicative)", "scope": "Scope 3"},
    "purchased_goods_inr": {"factor": 0.0005, "source": "Spend-based EEIO placeholder for INR", "scope": "Scope 3"},
}

CATEGORY_MAP: Dict[str, str] = {
    "electricity_grid_kwh": "Energy",
    "diesel_liter": "Transport",
    "petrol_liter": "Transport",
    "cng_kg": "Transport",
    "flight_km_economy": "Transport",
    "rail_km": "Transport",
    "bus_km": "Transport",
    "landfill_waste_kg": "Waste",
    "recycled_waste_kg": "Waste",
    "paper_kg": "Waste",
    "hotel_night": "Purchases",
    "purchased_goods_inr": "Purchases",
}

REQUIRED_COLUMNS = [
    "record_id",
    "organization_id",
    "employee_id",
    "employee_name",
    "department",
    "date",
    "activity_type",
    "quantity",
    "unit",
]

OPTIONAL_COLUMNS = [
    "source_category",
    "spend_inr",
    "vendor",
    "location",
    "scope",
    "notes",
]

_DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def _normalize_date_string(value: Any) -> str:
    raw = str(value or "").strip()
    if not raw:
        return ""

    # Canonical format first.
    if _DATE_RE.match(raw):
        return raw

    # Common tabular date formats seen in enterprise exports.
    candidates = [
        (r"^(\d{2})-(\d{2})-(\d{4})$", (3, 2, 1)),  # DD-MM-YYYY
        (r"^(\d{2})/(\d{2})/(\d{4})$", (3, 2, 1)),  # DD/MM/YYYY
        (r"^(\d{4})/(\d{2})/(\d{2})$", (1, 2, 3)),  # YYYY/MM/DD
        (r"^(\d{2})\. (\d{2})\. (\d{4})$", (3, 2, 1)),
        (r"^(\d{2})\.(\d{2})\.(\d{4})$", (3, 2, 1)),
    ]

    for pattern, order in candidates:
        m = re.match(pattern, raw)
        if not m:
            continue
        y = int(m.group(order[0]))
        mn = int(m.group(order[1]))
        d = int(m.group(order[2]))
        try:
            return date(y, mn, d).isoformat()
        except Exception:
            return ""

    return ""


@dataclass
class RowEmission:
    record_id: str
    employee_id: str
    employee_name: str
    department: str
    date: str
    activity_type: str
    quantity: float
    unit: str
    category: str
    scope: str
    emission_factor: float
    emissions_kg_co2e: float
    factor_source: str



def _safe_float(value: Any, default: float = 0.0) -> float:
    try:
        if value is None or value == "":
            return default
        return float(value)
    except Exception:
        return default



def _validate_headers(headers: List[str]) -> None:
    missing = [c for c in REQUIRED_COLUMNS if c not in headers]
    if missing:
        raise ValueError(f"Missing required columns: {', '.join(missing)}")


def _canonical_key(key: str) -> str:
    return str(key or "").strip().lower().replace(" ", "_")


def _normalize_row_keys(row: Dict[str, Any]) -> Dict[str, Any]:
    return {_canonical_key(k): v for k, v in row.items()}


def _validate_row_schema(row: Dict[str, Any], row_index: int, seen_record_ids: set) -> None:
    record_id = str(row.get("record_id", "")).strip()
    if not record_id:
        raise ValueError("Missing record_id")
    if record_id in seen_record_ids:
        raise ValueError("Duplicate record_id")
    seen_record_ids.add(record_id)

    date_value = _normalize_date_string(row.get("date", ""))
    if not _DATE_RE.match(date_value):
        raise ValueError("Invalid date format; expected YYYY-MM-DD")
    try:
        date.fromisoformat(date_value)
    except Exception:
        raise ValueError("Invalid calendar date")
    row["date"] = date_value

    quantity = _safe_float(row.get("quantity"), default=float("nan"))
    if quantity != quantity or quantity <= 0:  # NaN-safe check
        raise ValueError("quantity must be a positive number")

    unit = str(row.get("unit", "")).strip()
    if not unit:
        raise ValueError("unit is required")

    activity_type = str(row.get("activity_type", "")).strip().lower()
    if activity_type not in EMISSION_FACTORS_KGCO2E:
        raise ValueError(f"Unsupported activity_type '{activity_type}'. Add factor mapping first.")

    if not str(row.get("organization_id", "")).strip():
        raise ValueError("organization_id is required")
    if not str(row.get("employee_id", "")).strip():
        raise ValueError("employee_id is required")
    if not str(row.get("employee_name", "")).strip():
        raise ValueError("employee_name is required")
    if not str(row.get("department", "")).strip():
        raise ValueError("department is required")



def _factor_for_row(row: Dict[str, Any]) -> Tuple[float, str, str, str]:
    activity_type = str(row.get("activity_type", "")).strip().lower()
    factor_info = EMISSION_FACTORS_KGCO2E.get(activity_type)
    if not factor_info:
        raise ValueError(f"Unsupported activity_type '{activity_type}'. Add factor mapping first.")

    category = CATEGORY_MAP.get(activity_type, "Other")
    scope = str(row.get("scope", "")).strip() or factor_info["scope"]
    return float(factor_info["factor"]), factor_info["source"], category, scope



def calculate_emissions_from_rows(rows: List[Dict[str, Any]]) -> Dict[str, Any]:
    computed_rows: List[RowEmission] = []
    rejected_rows: List[Dict[str, Any]] = []

    for idx, row in enumerate(rows, start=1):
        try:
            factor, source, category, scope = _factor_for_row(row)
            quantity = _safe_float(row.get("quantity"), default=0.0)
            emissions = quantity * factor

            computed_rows.append(
                RowEmission(
                    record_id=str(row.get("record_id", f"row-{idx}")),
                    employee_id=str(row.get("employee_id", "")),
                    employee_name=str(row.get("employee_name", "")),
                    department=str(row.get("department", "")),
                    date=str(row.get("date", "")),
                    activity_type=str(row.get("activity_type", "")),
                    quantity=quantity,
                    unit=str(row.get("unit", "")),
                    category=category,
                    scope=scope,
                    emission_factor=factor,
                    emissions_kg_co2e=round(emissions, 4),
                    factor_source=source,
                )
            )
        except Exception as e:
            rejected_rows.append({
                "row_index": idx,
                "record_id": row.get("record_id"),
                "reason": str(e),
            })

    total_kg = round(sum(r.emissions_kg_co2e for r in computed_rows), 4)

    by_category: Dict[str, float] = {}
    by_scope: Dict[str, float] = {}
    by_employee: Dict[str, Dict[str, Any]] = {}

    for r in computed_rows:
        by_category[r.category] = round(by_category.get(r.category, 0.0) + r.emissions_kg_co2e, 4)
        by_scope[r.scope] = round(by_scope.get(r.scope, 0.0) + r.emissions_kg_co2e, 4)

        emp_key = r.employee_id or r.employee_name or "unknown"
        if emp_key not in by_employee:
            by_employee[emp_key] = {
                "employee_id": r.employee_id,
                "employee_name": r.employee_name,
                "department": r.department,
                "emissions_kg_co2e": 0.0,
                "records": 0,
            }
        by_employee[emp_key]["emissions_kg_co2e"] = round(
            by_employee[emp_key]["emissions_kg_co2e"] + r.emissions_kg_co2e, 4
        )
        by_employee[emp_key]["records"] += 1

    top_employees = sorted(
        by_employee.values(), key=lambda x: x["emissions_kg_co2e"], reverse=True
    )[:10]

    kpi_snapshots = [
        {"kpi_name": "total_emissions_kg_co2e", "kpi_value": total_kg, "kpi_unit": "kgCO2e", "meta": {}},
    ]
    for cat, val in sorted(by_category.items(), key=lambda kv: kv[1], reverse=True):
        kpi_snapshots.append(
            {
                "kpi_name": f"category_{cat.lower()}_kg_co2e",
                "kpi_value": val,
                "kpi_unit": "kgCO2e",
                "meta": {"category": cat},
            }
        )

    return {
        "formula": "Emissions = Activity Data x Emission Factor",
        "factor_catalog": EMISSION_FACTORS_KGCO2E,
        "totals": {
            "total_kg_co2e": total_kg,
            "total_tco2e": round(total_kg / 1000.0, 6),
            "records_processed": len(computed_rows),
            "records_rejected": len(rejected_rows),
        },
        "breakdown": {
            "by_category_kg_co2e": by_category,
            "by_scope_kg_co2e": by_scope,
            "top_employees_kg_co2e": top_employees,
        },
        "kpi_snapshots": kpi_snapshots,
        "computed_rows": [r.__dict__ for r in computed_rows],
        "rejected_rows": rejected_rows,
    }


def calculate_emissions_from_tabular_rows(rows: List[Dict[str, Any]]) -> Dict[str, Any]:
    if not rows:
        raise ValueError("Input file has no rows")

    normalized_rows = [_normalize_row_keys(r) for r in rows]
    headers = list(normalized_rows[0].keys())
    _validate_headers(headers)

    valid_rows: List[Dict[str, Any]] = []
    rejected_rows: List[Dict[str, Any]] = []
    seen_record_ids = set()

    for idx, row in enumerate(normalized_rows, start=1):
        try:
            _validate_row_schema(row, idx, seen_record_ids)
            row["activity_type"] = str(row.get("activity_type", "")).strip().lower()
            row["date"] = str(row.get("date", "")).strip()
            valid_rows.append(row)
        except Exception as e:
            rejected_rows.append(
                {
                    "row_index": idx,
                    "record_id": row.get("record_id"),
                    "reason": str(e),
                }
            )

    result = calculate_emissions_from_rows(valid_rows)
    result["rejected_rows"] = rejected_rows + (result.get("rejected_rows") or [])
    result["totals"]["records_rejected"] = len(result["rejected_rows"])
    return result



def calculate_emissions_from_csv_text(csv_text: str) -> Dict[str, Any]:
    reader = csv.DictReader(io.StringIO(csv_text))
    headers = reader.fieldnames or []
    _validate_headers(headers)

    rows = [dict(r) for r in reader]
    return calculate_emissions_from_tabular_rows(rows)
