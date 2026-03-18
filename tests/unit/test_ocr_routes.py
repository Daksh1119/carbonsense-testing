import io
import sys
import zipfile
from pathlib import Path

from fastapi import FastAPI
from fastapi.testclient import TestClient


ROOT_DIR = Path(__file__).resolve().parents[2]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

import packages.ml_services.api.ocr_routes as ocr_routes


app = FastAPI()
app.include_router(ocr_routes.router)
client = TestClient(app)


def _zip_bytes(entries: dict[str, bytes]) -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, mode="w", compression=zipfile.ZIP_DEFLATED) as zf:
        for name, payload in entries.items():
            zf.writestr(name, payload)
    return buf.getvalue()


def test_ocr_health_endpoint():
    r = client.get("/ocr/health")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ok"
    assert body["service"] == "ocr"


def test_ocr_capabilities_endpoint():
    r = client.get("/ocr/capabilities")
    assert r.status_code == 200
    body = r.json()
    assert "single_receipt" in body
    assert "bulk_receipts" in body
    assert ".pdf" in body["single_receipt"]["allowed_extensions"]


def test_single_receipt_rejects_unsupported_extension(monkeypatch):
    monkeypatch.setattr(ocr_routes, "ensure_user_in_org", lambda *_args, **_kwargs: None)
    monkeypatch.setattr(ocr_routes, "ensure_permission", lambda *_args, **_kwargs: None)

    files = {"file": ("receipt.exe", b"dummy", "application/octet-stream")}
    data = {
        "organization_id": "org_a",
        "uploaded_by": "user_a",
    }
    r = client.post("/ocr/receipt", files=files, data=data)
    assert r.status_code == 400
    assert "Unsupported file type" in r.text


def test_bulk_rejects_non_zip(monkeypatch):
    monkeypatch.setattr(ocr_routes, "ensure_user_in_org", lambda *_args, **_kwargs: None)
    monkeypatch.setattr(ocr_routes, "ensure_permission", lambda *_args, **_kwargs: None)

    files = {"zip_file": ("batch.txt", b"not_zip", "text/plain")}
    data = {
        "organization_id": "org_a",
        "uploaded_by": "user_a",
    }
    r = client.post("/ocr/receipts/bulk", files=files, data=data)
    assert r.status_code == 400


def test_bulk_success_contract(monkeypatch):
    monkeypatch.setattr(ocr_routes, "ensure_user_in_org", lambda *_args, **_kwargs: None)
    monkeypatch.setattr(ocr_routes, "ensure_permission", lambda *_args, **_kwargs: None)

    expected = {
        "success": True,
        "organization_id": "org_a",
        "uploaded_by": "user_a",
        "total_files": 1,
        "processed_count": 1,
        "failed_count": 0,
        "results": [
            {
                "file_name": "r1.png",
                "success": True,
                "receipt_id": "rid-1",
                "confidence": 0.88,
                "requires_review": False,
                "error": None,
            }
        ],
    }

    monkeypatch.setattr(ocr_routes, "process_receipt_batch", lambda **_kwargs: expected)

    zbytes = _zip_bytes({"r1.png": b"\x89PNG\r\n\x1a\n"})
    files = {"zip_file": ("batch.zip", zbytes, "application/zip")}
    data = {
        "organization_id": "org_a",
        "uploaded_by": "user_a",
    }

    r = client.post("/ocr/receipts/bulk", files=files, data=data)
    assert r.status_code == 200
    body = r.json()
    assert body["processed_count"] == 1
    assert body["failed_count"] == 0
    assert body["results"][0]["receipt_id"] == "rid-1"
