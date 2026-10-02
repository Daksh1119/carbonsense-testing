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
    "department",
    "date",
    "activity_type",
    "quantity",
    "unit",
]

# Legacy and flexible column sets
EMITTER_ID_CANDIDATES = ["emitter_id", "employee_id", "asset_id"]
EMITTER_NAME_CANDIDATES = ["emitter_name", "employee_name", "asset_name"]

OPTIONAL_COLUMNS = [
    "emitter_type",
    "emitter_id",
    "emitter_name",
    "employee_id",
    "employee_name",
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
    emitter_type: str
    emitter_id: str
    emitter_name: str
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
    employee_id: str = ""
    employee_name: str = ""



def _safe_float(value: Any, default: float = 0.0) -> float:
    try:
        if value is None or value == "":
            return default
        return float(value)
    except Exception:
        return default



def _validate_headers(headers: List[str]) -> None:
    missing = [c for c in REQUIRED_COLUMNS if c not in headers]
    has_id = any(c in headers for c in EMITTER_ID_CANDIDATES)
    has_name = any(c in headers for c in EMITTER_NAME_CANDIDATES)
    if not has_id:
        missing.append("emitter_id (or employee_id)")
    if not has_name:
        missing.append("emitter_name (or employee_name)")
    if missing:
        raise ValueError(f"Missing required columns: {', '.join(missing)}")


def _canonical_key(key: str) -> str:
    return str(key or "").strip().lower().replace(" ", "_")


def _normalize_row_keys(row: Dict[str, Any]) -> Dict[str, Any]:
    return {_canonical_key(k): v for k, v in row.items()}


def _infer_emitter_type(row: Dict[str, Any]) -> str:
    raw_type = str(row.get("emitter_type") or "").strip().lower()
    if raw_type in {"employee", "machinery", "facility"}:
        return raw_type
    if raw_type in {"machine", "equipment", "vehicle", "generator", "fleet"}:
        return "machinery"
    if raw_type in {"building", "plant", "site", "office", "campus"}:
        return "facility"
    if raw_type in {"person", "staff", "worker", "user"}:
        return "employee"

    # If employee_id is explicitly provided and no machine/facility context, assume employee
    if row.get("employee_id") and not row.get("emitter_type"):
        return "employee"

    activity_type = str(row.get("activity_type", "")).strip().lower()
    if activity_type in {"electricity_grid_kwh", "landfill_waste_kg", "recycled_waste_kg", "paper_kg"}:
        return "facility"
    if activity_type in {"diesel_liter", "petrol_liter", "cng_kg"}:
        return "machinery"
    return "employee"


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

    # Unified emitter resolution with legacy fallback
    emitter_id = str(
        row.get("emitter_id") or row.get("employee_id") or row.get("asset_id") or ""
    ).strip()
    if not emitter_id:
        raise ValueError("emitter_id (or employee_id) is required")

    emitter_name = str(
        row.get("emitter_name") or row.get("employee_name") or row.get("asset_name") or ""
    ).strip()
    if not emitter_name:
        raise ValueError("emitter_name (or employee_name) is required")

    emitter_type = _infer_emitter_type(row)

    row["emitter_id"] = emitter_id
    row["emitter_name"] = emitter_name
    row["emitter_type"] = emitter_type
    row["employee_id"] = emitter_id
    row["employee_name"] = emitter_name

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
                    emitter_type=str(row.get("emitter_type", "employee")),
                    emitter_id=str(row.get("emitter_id", row.get("employee_id", ""))),
                    emitter_name=str(row.get("emitter_name", row.get("employee_name", ""))),
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
                    employee_id=str(row.get("employee_id", row.get("emitter_id", ""))),
                    employee_name=str(row.get("employee_name", row.get("emitter_name", ""))),
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
    by_emitter_type: Dict[str, float] = {}
    by_employee: Dict[str, Dict[str, Any]] = {}
    by_machinery: Dict[str, Dict[str, Any]] = {}
    by_facility: Dict[str, Dict[str, Any]] = {}

    for r in computed_rows:
        by_category[r.category] = round(by_category.get(r.category, 0.0) + r.emissions_kg_co2e, 4)
        by_scope[r.scope] = round(by_scope.get(r.scope, 0.0) + r.emissions_kg_co2e, 4)
        by_emitter_type[r.emitter_type] = round(
            by_emitter_type.get(r.emitter_type, 0.0) + r.emissions_kg_co2e, 4
        )

        key = r.emitter_id or r.emitter_name or "unknown"
        entry = {
            "emitter_id": r.emitter_id,
            "emitter_name": r.emitter_name,
            "emitter_type": r.emitter_type,
            "employee_id": r.emitter_id,
            "employee_name": r.emitter_name,
            "department": r.department,
            "emissions_kg_co2e": 0.0,
            "records": 0,
        }

        if r.emitter_type == "machinery":
            target_map = by_machinery
        elif r.emitter_type == "facility":
            target_map = by_facility
        else:
            target_map = by_employee

        if key not in target_map:
            target_map[key] = entry
        target_map[key]["emissions_kg_co2e"] = round(
            target_map[key]["emissions_kg_co2e"] + r.emissions_kg_co2e, 4
        )
        target_map[key]["records"] += 1

        # Also maintain by_employee for legacy callers if needed
        if target_map is not by_employee and key not in by_employee:
            by_employee[key] = dict(entry)
            by_employee[key]["emissions_kg_co2e"] = round(r.emissions_kg_co2e, 4)
            by_employee[key]["records"] = 1
        elif target_map is not by_employee:
            by_employee[key]["emissions_kg_co2e"] = round(
                by_employee[key]["emissions_kg_co2e"] + r.emissions_kg_co2e, 4
            )
            by_employee[key]["records"] += 1

    top_employees = sorted(
        [v for v in by_employee.values() if v.get("emitter_type") == "employee"],
        key=lambda x: x["emissions_kg_co2e"],
        reverse=True,
    )[:10]
    # Fallback to top emitters overall if no specific employee emitters exist
    if not top_employees and by_employee:
        top_employees = sorted(
            by_employee.values(), key=lambda x: x["emissions_kg_co2e"], reverse=True
        )[:10]

    top_machinery = sorted(
        by_machinery.values(), key=lambda x: x["emissions_kg_co2e"], reverse=True
    )[:10]
    top_facilities = sorted(
        by_facility.values(), key=lambda x: x["emissions_kg_co2e"], reverse=True
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
    for em_type, val in sorted(by_emitter_type.items(), key=lambda kv: kv[1], reverse=True):
        kpi_snapshots.append(
            {
                "kpi_name": f"emitter_type_{em_type.lower()}_kg_co2e",
                "kpi_value": val,
                "kpi_unit": "kgCO2e",
                "meta": {"emitter_type": em_type},
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
            "by_emitter_type_kg_co2e": by_emitter_type,
            "top_employees_kg_co2e": top_employees,
            "top_machinery_kg_co2e": top_machinery,
            "top_facilities_kg_co2e": top_facilities,
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
