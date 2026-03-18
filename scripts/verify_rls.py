import os
import requests
from dataclasses import dataclass

from dotenv import load_dotenv
load_dotenv()

import uuid

SUPABASE_URL = os.environ["SUPABASE_URL"].rstrip("/")
SUPABASE_ANON_KEY = os.environ["SUPABASE_ANON_KEY"]

ORG_A = os.environ["ORG_A"]
ORG_B = os.environ["ORG_B"]

ADMIN_A_EMAIL = os.environ["ADMIN_A_EMAIL"]
ADMIN_A_PASSWORD = os.environ["ADMIN_A_PASSWORD"]

ANALYST_A_EMAIL = os.environ["ANALYST_A_EMAIL"]
ANALYST_A_PASSWORD = os.environ["ANALYST_A_PASSWORD"]

MANAGER_A_EMAIL = os.environ["MANAGER_A_EMAIL"]
MANAGER_A_PASSWORD = os.environ["MANAGER_A_PASSWORD"]

VIEWER_A_EMAIL = os.environ["VIEWER_A_EMAIL"]
VIEWER_A_PASSWORD = os.environ["VIEWER_A_PASSWORD"]


@dataclass
class Session:
    access_token: str
    user_id: str

def get_env(name: str) -> str:
    v = os.getenv(name)
    if not v:
        raise RuntimeError(f"Missing required env var: {name}. Check your .env file.")
    return v

ORG_A = get_env("ORG_A")
ORG_B = get_env("ORG_B")

def sign_in(email: str, password: str) -> Session:
    url = f"{SUPABASE_URL}/auth/v1/token?grant_type=password"
    r = requests.post(
        url,
        headers={"apikey": SUPABASE_ANON_KEY, "Content-Type": "application/json"},
        json={"email": email, "password": password},
        timeout=30,
    )
    if r.status_code >= 400:
        print("SIGN-IN FAILED:", email, "status=", r.status_code, "body=", r.text)
    r.raise_for_status()
    data = r.json()
    return Session(access_token=data["access_token"], user_id=data["user"]["id"])


def rest_headers(token: str):
    return {
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }


def select_receipts(token: str, org_id: str):
    url = f"{SUPABASE_URL}/rest/v1/receipts_ocr_results"
    params = {
        "select": "receipt_id,organization_id,carbon_total_kg",
        "organization_id": f"eq.{org_id}",
    }
    r = requests.get(url, headers=rest_headers(token), params=params, timeout=30)
    return r.status_code, r.json() if r.content else None


def insert_receipt(token: str, org_id: str, uploaded_by: str, file_name: str):
    url = f"{SUPABASE_URL}/rest/v1/receipts_ocr_results"
    payload = [{
        "organization_id": org_id,
        "uploaded_by": uploaded_by,
        "employee_user_id": uploaded_by,
        "employee_department": "sustainability",
        "source_file_name": file_name,
        "ocr_text": "test receipt",
        "ocr_method": "tesseract",
        "carbon_total_kg": 1.23,
        "mapped_items": [],
        "status": "processed",
        "receipt_id": str(uuid.uuid4())
    }]
    r = requests.post(
        url,
        headers={**rest_headers(token), "Prefer": "return=representation"},
        json=payload,
        timeout=30,
    )
    if r.status_code >= 400:
        print("INSERT FAILED:", r.status_code, r.text)
    return r.status_code, r.json() if r.content else None


def delete_one_receipt(token: str, org_id: str):
    sel_code, rows = select_receipts(token, org_id)
    if sel_code != 200 or not rows:
        return 200, []

    rid = rows[0]["receipt_id"]
    url = f"{SUPABASE_URL}/rest/v1/receipts_ocr_results"
    params = {"receipt_id": f"eq.{rid}"}
    r = requests.delete(
        url,
        headers={**rest_headers(token), "Prefer": "return=representation"},
        params=params,
        timeout=30,
    )
    body = r.json() if r.content else []
    return r.status_code, body


def check(name: str, cond: bool, detail=""):
    print(f"[{'PASS' if cond else 'FAIL'}] {name} {detail}")


def main():
    admin = sign_in(ADMIN_A_EMAIL, ADMIN_A_PASSWORD)
    manager = sign_in(MANAGER_A_EMAIL, MANAGER_A_PASSWORD)
    analyst = sign_in(ANALYST_A_EMAIL, ANALYST_A_PASSWORD)
    viewer = sign_in(VIEWER_A_EMAIL, VIEWER_A_PASSWORD)

    # 1) admin A can read org A
    code, rows = select_receipts(admin.access_token, ORG_A)
    check("Admin A reads ORG_A", code == 200, f"(rows={len(rows) if isinstance(rows, list) else 'n/a'})")

    # 2) admin A cannot read org B rows (should return 200 with empty list under RLS)
    code, rows = select_receipts(admin.access_token, ORG_B)
    check("Admin A cannot read ORG_B", code == 200 and isinstance(rows, list) and len(rows) == 0)

    # 3) admin A can insert ORG_A
    code, body = insert_receipt(admin.access_token, ORG_A, admin.user_id, "admin-a-ok.jpg")
    check("Admin A insert ORG_A", code in (200, 201), f"(status={code})")

    # 4) manager A can read org A data
    code, rows = select_receipts(manager.access_token, ORG_A)
    check("Manager A reads ORG_A", code == 200, f"(rows={len(rows) if isinstance(rows, list) else 'n/a'})")

    # 5) manager A insert should fail (manager can approve/report, not edit raw entries)
    code, body = insert_receipt(manager.access_token, ORG_A, manager.user_id, "manager-a-deny.jpg")
    check("Manager A insert denied", code in (401, 403), f"(status={code})")

    # 6) analyst A insert should fail (no edit permission)
    code, body = insert_receipt(analyst.access_token, ORG_A, analyst.user_id, "analyst-a-deny.jpg")
    check("Analyst A insert denied", code in (401, 403), f"(status={code})")

    # 7) viewer A delete should fail
    code, body = delete_one_receipt(viewer.access_token, ORG_A)
    # pass if denied explicitly OR deleted zero rows
    check("Viewer A delete denied", (code in (401, 403)) or (code == 200 and isinstance(body, list) and len(body) == 0), f"(status={code})")


if __name__ == "__main__":
    main()