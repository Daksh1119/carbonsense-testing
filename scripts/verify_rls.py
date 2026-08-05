"""
verify_rls.py — RLS (Row Level Security) verification harness.

Tests Supabase PostgREST RLS policies DIRECTLY (bypassing the FastAPI layer),
signing in as real users and asserting that data isolation holds.

Requires .env with:
    SUPABASE_URL, SUPABASE_ANON_KEY
    ORG_A, ORG_B
    ADMIN_A_EMAIL, ADMIN_A_PASSWORD     (role=admin,   org=A)
    MANAGER_A_EMAIL, MANAGER_A_PASSWORD (role=manager, org=A)
    ANALYST_A_EMAIL, ANALYST_A_PASSWORD (role=analyst, org=A)
    VIEWER_A_EMAIL, VIEWER_A_PASSWORD   (role=viewer,  org=A)
    MANAGER_B_EMAIL, MANAGER_B_PASSWORD (role=manager, org=B) -- cross-org
    VIEWER_B_EMAIL, VIEWER_B_PASSWORD   (role=viewer,  org=B) -- cross-org

Run:
    python scripts/verify_rls.py
"""

import os
import uuid
from dataclasses import dataclass

import requests
from dotenv import load_dotenv

load_dotenv()


# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

def get_env(name: str) -> str:
    v = os.getenv(name)
    if not v:
        raise RuntimeError(f"Missing required env var: {name}. Check your .env file.")
    return v


SUPABASE_URL = get_env("SUPABASE_URL").rstrip("/")
SUPABASE_ANON_KEY = get_env("SUPABASE_ANON_KEY")
ORG_A = get_env("ORG_A")
ORG_B = get_env("ORG_B")

# Org A users
ADMIN_A_EMAIL    = get_env("ADMIN_A_EMAIL")
ADMIN_A_PASSWORD = get_env("ADMIN_A_PASSWORD")
MANAGER_A_EMAIL    = get_env("MANAGER_A_EMAIL")
MANAGER_A_PASSWORD = get_env("MANAGER_A_PASSWORD")
ANALYST_A_EMAIL    = get_env("ANALYST_A_EMAIL")
ANALYST_A_PASSWORD = get_env("ANALYST_A_PASSWORD")
VIEWER_A_EMAIL    = get_env("VIEWER_A_EMAIL")
VIEWER_A_PASSWORD = get_env("VIEWER_A_PASSWORD")

# Org B users (cross-org isolation tests)
MANAGER_B_EMAIL    = os.getenv("MANAGER_B_EMAIL", "")
MANAGER_B_PASSWORD = os.getenv("MANAGER_B_PASSWORD", "")
VIEWER_B_EMAIL    = os.getenv("VIEWER_B_EMAIL", "")
VIEWER_B_PASSWORD = os.getenv("VIEWER_B_PASSWORD", "")


# ---------------------------------------------------------------------------
# Auth helpers
# ---------------------------------------------------------------------------

@dataclass
class Session:
    access_token: str
    user_id: str
    label: str  # human-readable, for test output


def sign_in(email: str, password: str, label: str) -> Session:
    url = f"{SUPABASE_URL}/auth/v1/token?grant_type=password"
    r = requests.post(
        url,
        headers={"apikey": SUPABASE_ANON_KEY, "Content-Type": "application/json"},
        json={"email": email, "password": password},
        timeout=30,
    )
    if r.status_code >= 400:
        print(f"[SIGN-IN FAILED] {label} ({email}): status={r.status_code} body={r.text}")
    r.raise_for_status()
    data = r.json()
    return Session(access_token=data["access_token"], user_id=data["user"]["id"], label=label)


def rest_headers(token: str) -> dict:
    return {
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }


# ---------------------------------------------------------------------------
# Table operations (teme_runs)
# ---------------------------------------------------------------------------

def select_teme_runs(token: str, org_id: str):
    url = f"{SUPABASE_URL}/rest/v1/teme_runs"
    params = {
        "select": "id,organization_id,emission_kg",
        "organization_id": f"eq.{org_id}",
    }
    r = requests.get(url, headers=rest_headers(token), params=params, timeout=30)
    return r.status_code, r.json() if r.content else None


def insert_teme_run(token: str, org_id: str, user_id: str):
    url = f"{SUPABASE_URL}/rest/v1/teme_runs"
    import uuid as _uuid
    payload = [{
        "organization_id": org_id,
        "user_id": user_id,
        "emission_kg": 1.0,
        "project_name": "rls-verify-test",
        "input_payload": {},
        "result": {},
        "total_trees": 1,
        "confidence_score": 0.9,
        "time_to_neutral_years": 10.0,
        "land_required_hectare": 0.5,
        "status": "completed",
    }]
    r = requests.post(
        url,
        headers={**rest_headers(token), "Prefer": "return=representation"},
        json=payload,
        timeout=30,
    )
    if r.status_code >= 400:
        print(f"INSERT FAILED ({org_id=}): status={r.status_code} body={r.text}")
    return r.status_code, r.json() if r.content else None


# ---------------------------------------------------------------------------
# Assertion helper
# ---------------------------------------------------------------------------

_results: list[tuple[bool, str]] = []


def check(name: str, cond: bool, detail: str = "") -> None:
    status = "PASS" if cond else "FAIL"
    _results.append((cond, name))
    print(f"[{status}] {name} {detail}")


# ---------------------------------------------------------------------------
# Test suites
# ---------------------------------------------------------------------------

def test_org_a_internal(admin: Session, manager: Session, analyst: Session, viewer: Session) -> None:
    print("\n── Org A: internal role-based access (teme_runs) ────────────────")

    # Admin reads own org runs
    code, rows = select_teme_runs(admin.access_token, ORG_A)
    check("Admin A reads ORG_A teme_runs", code == 200,
          f"(rows={len(rows) if isinstance(rows, list) else 'n/a'})")

    # Admin cannot see another org's runs (RLS filters them out)
    code, rows = select_teme_runs(admin.access_token, ORG_B)
    check("Admin A cannot read ORG_B teme_runs",
          code == 200 and isinstance(rows, list) and len(rows) == 0)

    # Manager reads own org runs
    code, rows = select_teme_runs(manager.access_token, ORG_A)
    check("Manager A reads ORG_A teme_runs", code == 200,
          f"(rows={len(rows) if isinstance(rows, list) else 'n/a'})")

    # Manager can insert into own org
    code, body = insert_teme_run(manager.access_token, ORG_A, manager.user_id)
    check("Manager A insert ORG_A teme_run", code in (200, 201), f"(status={code})")

    # Viewer reads only own runs (select RLS — just checking it doesn't 403)
    code, rows = select_teme_runs(viewer.access_token, ORG_A)
    check("Viewer A select ORG_A allowed", code == 200,
          f"(rows={len(rows) if isinstance(rows, list) else 'n/a'})")


def test_cross_org_isolation(manager_b: Session, viewer_b: Session) -> None:
    """Critical: Org B users must NEVER be able to read or write Org A data."""
    print("\n── Cross-org isolation — teme_runs (Org B vs Org A) ───────────────")

    # Manager B cannot read ORG_A runs
    code, rows = select_teme_runs(manager_b.access_token, ORG_A)
    check(
        "Manager B cannot read ORG_A teme_runs",
        code == 200 and isinstance(rows, list) and len(rows) == 0,
        f"(status={code}, rows={len(rows) if isinstance(rows, list) else 'n/a'})",
    )

    # Manager B cannot insert into ORG_A
    code, body = insert_teme_run(manager_b.access_token, ORG_A, manager_b.user_id)
    check("Manager B cannot insert into ORG_A teme_runs", code in (401, 403), f"(status={code})")

    # Viewer B cannot read ORG_A runs
    code, rows = select_teme_runs(viewer_b.access_token, ORG_A)
    check(
        "Viewer B cannot read ORG_A teme_runs",
        code == 200 and isinstance(rows, list) and len(rows) == 0,
        f"(status={code}, rows={len(rows) if isinstance(rows, list) else 'n/a'})",
    )

    # Viewer B can read own org
    code, rows = select_teme_runs(viewer_b.access_token, ORG_B)
    check("Viewer B reads own ORG_B teme_runs", code == 200,
          f"(rows={len(rows) if isinstance(rows, list) else 'n/a'})")


def test_manager_b_cannot_inject_teme_run(manager_b: Session) -> None:
    """Specific test for the teme_runs cross-tenant RLS fix."""
    print("\n── teme_runs: cross-org insert injection (org B manager -> org A) ─")
    url = f"{SUPABASE_URL}/rest/v1/teme_runs"
    payload = [{
        "organization_id": ORG_A,   # <-- trying to inject into a DIFFERENT org
        "user_id": manager_b.user_id,
        "emission_kg": 500.0,
        "plan_json": "{}",
    }]
    r = requests.post(
        url,
        headers={**rest_headers(manager_b.access_token), "Prefer": "return=representation"},
        json=payload,
        timeout=30,
    )
    check(
        "Manager B cannot inject teme_run into ORG_A",
        r.status_code in (401, 403),
        f"(status={r.status_code})",
    )


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    # Sign in all Org A users (required)
    admin    = sign_in(ADMIN_A_EMAIL, ADMIN_A_PASSWORD, "Admin A")
    manager  = sign_in(MANAGER_A_EMAIL, MANAGER_A_PASSWORD, "Manager A")
    analyst  = sign_in(ANALYST_A_EMAIL, ANALYST_A_PASSWORD, "Analyst A")
    viewer   = sign_in(VIEWER_A_EMAIL, VIEWER_A_PASSWORD, "Viewer A")

    test_org_a_internal(admin, manager, analyst, viewer)

    # Sign in Org B users (optional — skip if not configured)
    if MANAGER_B_EMAIL and MANAGER_B_PASSWORD:
        manager_b = sign_in(MANAGER_B_EMAIL, MANAGER_B_PASSWORD, "Manager B")
        viewer_b  = sign_in(VIEWER_B_EMAIL, VIEWER_B_PASSWORD, "Viewer B") if VIEWER_B_EMAIL else None
        test_cross_org_isolation(manager_b, viewer_b or manager_b)
        test_manager_b_cannot_inject_teme_run(manager_b)
    else:
        print("\n[SKIP] Cross-org isolation tests skipped — MANAGER_B_EMAIL not configured in .env")
        print("       Add MANAGER_B_EMAIL, MANAGER_B_PASSWORD, VIEWER_B_EMAIL, VIEWER_B_PASSWORD")
        print("       to fully verify cross-tenant data isolation.")

    # Summary
    passed = sum(1 for ok, _ in _results if ok)
    total  = len(_results)
    print(f"\n{'='*60}")
    print(f"Results: {passed}/{total} passed")
    if passed < total:
        print("FAILED tests:")
        for ok, name in _results:
            if not ok:
                print(f"  ✗ {name}")
    else:
        print("All tests passed ✓")


if __name__ == "__main__":
    main()