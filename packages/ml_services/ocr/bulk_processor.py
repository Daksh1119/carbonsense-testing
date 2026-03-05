from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import List, Dict, Optional
from collections import defaultdict

from ml_services.ocr.single_processor import process_single_receipt


MAX_WORKERS = 8


def aggregate_by_category(receipts: List[Dict]) -> Dict[str, float]:
    cat = defaultdict(float)
    for r in receipts:
        for i in r["carbon_analysis"]["mapped_items"]:
            cat[i.get("category", "unknown")] += float(i.get("carbon_kg", 0.0))
    return {k: round(v, 4) for k, v in cat.items()}


def aggregate_by_department(receipts: List[Dict]) -> Dict[str, float]:
    dept = defaultdict(float)
    for r in receipts:
        d = r.get("employee_department") or "unassigned"
        dept[d] += float(r["carbon_analysis"]["total_carbon_kg"])
    return {k: round(v, 4) for k, v in dept.items()}


def process_receipt_batch(
    receipt_paths: List[str],
    organization_id: str,
    uploaded_by_user_id: str,
    employee_user_id: Optional[str] = None,
) -> Dict:
    results = []
    failed = []

    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        futures = {
            executor.submit(
                process_single_receipt,
                file_path=path,
                file_name=Path(path).name,
                organization_id=organization_id,
                uploaded_by_user_id=uploaded_by_user_id,
                employee_user_id=employee_user_id,
            ): path
            for path in receipt_paths
        }

        for fut in as_completed(futures):
            p = futures[fut]
            try:
                results.append(fut.result())
            except Exception as e:
                failed.append({"path": p, "error": str(e)})

    total_carbon = sum(r["carbon_analysis"]["total_carbon_kg"] for r in results)
    by_cat = aggregate_by_category(results)
    by_dept = aggregate_by_department(results)

    top_cat = sorted(by_cat.items(), key=lambda x: x[1], reverse=True)[:5]

    return {
        "total_receipts": len(receipt_paths),
        "processed": len(results),
        "failed": len(failed),
        "failed_receipts": failed,
        "total_carbon_kg": round(total_carbon, 4),
        "receipts": results,
        "organization_summary": {
            "organization_id": organization_id,
            "category_breakdown": by_cat,
            "department_breakdown": by_dept,
            "average_per_receipt": round(total_carbon / max(len(results), 1), 4),
            "top_carbon_categories": [{"category": k, "carbon_kg": v} for k, v in top_cat],
        },
    }

