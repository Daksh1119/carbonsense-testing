import io
import sys
import zipfile
from pathlib import Path

import pytest


ROOT_DIR = Path(__file__).resolve().parents[2]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from packages.ml_services.ocr import bulk_processor


def _zip_bytes(entries: dict[str, bytes]) -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, mode="w", compression=zipfile.ZIP_DEFLATED) as zf:
        for name, payload in entries.items():
            zf.writestr(name, payload)
    return buf.getvalue()


def test_bulk_zip_invalid_archive_raises_value_error():
    with pytest.raises(ValueError, match="Invalid zip archive"):
        bulk_processor.process_receipt_batch(
            zip_bytes=b"not-a-zip",
            zip_name="bad.zip",
            organization_id="org_a",
            uploaded_by="user_a",
        )


def test_bulk_zip_without_receipts_raises_value_error():
    zbytes = _zip_bytes({"notes.txt": b"hello"})
    with pytest.raises(ValueError, match="No valid receipt files"):
        bulk_processor.process_receipt_batch(
            zip_bytes=zbytes,
            zip_name="empty_receipts.zip",
            organization_id="org_a",
            uploaded_by="user_a",
        )


def test_bulk_zip_success_contract(monkeypatch):
    # Minimal valid PNG signature is enough since we monkeypatch OCR processing.
    zbytes = _zip_bytes({"a/receipt_1.png": b"\x89PNG\r\n\x1a\n"})

    def _fake_single_receipt(**kwargs):
        return {
            "receipt_id": "r1",
            "confidence": 0.91,
            "requires_review": False,
        }

    monkeypatch.setattr(bulk_processor, "process_single_receipt", _fake_single_receipt)

    result = bulk_processor.process_receipt_batch(
        zip_bytes=zbytes,
        zip_name="receipts.zip",
        organization_id="org_a",
        uploaded_by="user_a",
    )

    assert result["organization_id"] == "org_a"
    assert result["uploaded_by"] == "user_a"
    assert result["total_files"] == 1
    assert result["processed_count"] == 1
    assert result["failed_count"] == 0
    assert result["success"] is True
    assert len(result["results"]) == 1
    assert result["results"][0]["file_name"] == "receipt_1.png"
    assert result["results"][0]["receipt_id"] == "r1"
    assert result["results"][0]["confidence"] == 0.91
