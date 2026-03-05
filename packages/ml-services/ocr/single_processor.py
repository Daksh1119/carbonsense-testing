import re
from datetime import datetime
from uuid import uuid4
from typing import Optional, Dict

from ml_services.ocr.text_extractor import extract_text
from ml_services.ocr.carbon_mapper import calculate_receipt_carbon, load_carbon_database
from ml_services.common.supabase_client import supabase
from ml_services.common.authz import get_user_department


def _parse_items_from_text(text: str):
    lines = text.splitlines()
    items = []
    for line in lines:
        if re.search(r"\d+(\.\d{1,2})?$", line.strip()):
            name = re.sub(r"\d+(\.\d{1,2})?$", "", line).strip()
            if len(name) > 2:
                items.append({"name": name})
    return items


def process_single_receipt(
    file_path: str,
    file_name: str,
    organization_id: str,
    uploaded_by_user_id: str,
    employee_user_id: Optional[str] = None,
) -> Dict:
    receipt_id = str(uuid4())
    extraction = extract_text(file_path)
    items = _parse_items_from_text(extraction["text"])
    carbon_db = load_carbon_database()
    carbon_result = calculate_receipt_carbon(items, carbon_db)

    employee_department = "unassigned"
    if employee_user_id:
        employee_department = get_user_department(employee_user_id, organization_id)

    row = {
        "receipt_id": receipt_id,
        "organization_id": organization_id,
        "uploaded_by": uploaded_by_user_id,
        "employee_user_id": employee_user_id,
        "employee_department": employee_department,
        "source_file_name": file_name,
        "ocr_text": extraction["text"],
        "ocr_method": extraction["method"],
        "carbon_total_kg": carbon_result["total_carbon_kg"],
        "mapped_items": carbon_result["mapped_items"],
        "status": "processed",
        "processed_at": datetime.utcnow().isoformat(),
    }

    supabase.table("receipts_ocr_results").insert(row).execute()
    return {
        **row,
        "carbon_analysis": {
            "total_carbon_kg": row["carbon_total_kg"],
            "mapped_items": row["mapped_items"],
        },
    }