from __future__ import annotations

import tempfile
import zipfile
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Dict, List, Optional

from ml_services.ocr.single_processor import process_single_receipt


MAX_WORKERS = 8
ALLOWED_RECEIPT_EXT = {".jpg", ".jpeg", ".png", ".pdf"}


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


def _process_paths_legacy(
    receipt_paths: List[str],
    organization_id: str,
    uploaded_by_user_id: str,
    employee_user_id: Optional[str] = None,
) -> Dict:
    """Legacy response contract used by older internal OCR API."""
    results: List[Dict] = []
    failed: List[Dict] = []

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


def _process_zip_for_active_api(
    zip_bytes: bytes,
    zip_name: str,
    organization_id: str,
    uploaded_by: str,
) -> Dict:
    """Active response contract used by ml_services.api.ocr_routes."""
    results: List[Dict] = []

    with tempfile.TemporaryDirectory() as tmpdir:
        tmp_root = Path(tmpdir).resolve()
        zip_path = Path(tmpdir) / (zip_name or "batch.zip")
        with open(zip_path, "wb") as f:
            f.write(zip_bytes)

        try:
            with zipfile.ZipFile(zip_path, "r") as zf:
                # Zip-slip safe extraction
                for member in zf.infolist():
                    member_path = (tmp_root / member.filename).resolve()
                    if tmp_root not in member_path.parents and member_path != tmp_root:
                        raise ValueError(f"Unsafe zip entry path: {member.filename}")
                zf.extractall(tmp_root)
        except zipfile.BadZipFile as e:
            raise ValueError(f"Invalid zip archive: {e}")

        receipt_paths = [
            str(p)
            for p in tmp_root.rglob("*")
            if p.is_file() and p.suffix.lower() in ALLOWED_RECEIPT_EXT
        ]

        if not receipt_paths:
            raise ValueError("No valid receipt files found in zip")

        with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
            futures = {
                executor.submit(
                    process_single_receipt,
                    file_path=path,
                    file_name=Path(path).name,
                    organization_id=organization_id,
                    uploaded_by_user_id=uploaded_by,
                    employee_user_id=None,
                ): path
                for path in receipt_paths
            }

            for fut in as_completed(futures):
                file_path = futures[fut]
                file_name = Path(file_path).name
                try:
                    data = fut.result()
                    results.append(
                        {
                            "file_name": file_name,
                            "success": True,
                            "receipt_id": data.get("receipt_id"),
                            "confidence": data.get("confidence"),
                            "requires_review": data.get("requires_review"),
                            "error": None,
                        }
                    )
                except Exception as e:
                    results.append(
                        {
                            "file_name": file_name,
                            "success": False,
                            "receipt_id": None,
                            "confidence": None,
                            "requires_review": None,
                            "error": str(e),
                        }
                    )

    processed_count = sum(1 for r in results if r["success"])
    failed_count = len(results) - processed_count

    return {
        "success": failed_count == 0,
        "organization_id": organization_id,
        "uploaded_by": uploaded_by,
        "total_files": len(results),
        "processed_count": processed_count,
        "failed_count": failed_count,
        "results": results,
    }


def process_receipt_batch(
    receipt_paths: Optional[List[str]] = None,
    organization_id: Optional[str] = None,
    uploaded_by_user_id: Optional[str] = None,
    employee_user_id: Optional[str] = None,
    *,
    zip_bytes: Optional[bytes] = None,
    zip_name: Optional[str] = None,
    uploaded_by: Optional[str] = None,
) -> Dict:
    """
    Backward-compatible bulk processor.

    Supported modes:
    - Legacy: receipt_paths + uploaded_by_user_id
    - Active API: zip_bytes + zip_name + uploaded_by
    """
    if zip_bytes is not None:
        if not organization_id or not uploaded_by:
            raise ValueError("organization_id and uploaded_by are required for zip mode")
        return _process_zip_for_active_api(
            zip_bytes=zip_bytes,
            zip_name=zip_name or "batch.zip",
            organization_id=organization_id,
            uploaded_by=uploaded_by,
        )

    if receipt_paths is None:
        raise ValueError("Either zip_bytes or receipt_paths must be provided")
    if not organization_id or not uploaded_by_user_id:
        raise ValueError("organization_id and uploaded_by_user_id are required for path mode")

    return _process_paths_legacy(
        receipt_paths=receipt_paths,
        organization_id=organization_id,
        uploaded_by_user_id=uploaded_by_user_id,
        employee_user_id=employee_user_id,
    )

