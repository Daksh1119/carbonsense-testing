import os
from typing import Optional
from fastapi import HTTPException

from ml_services.common.supabase_client import supabase


def _strict_authz_enabled() -> bool:
    """
    Authz is ENABLED BY DEFAULT — explicitly opt-out with AUTHZ_DISABLED=true.

    Rationale: "secure by default" is the correct fail-safe direction.
    Previously this was guarded by OCR_STRICT_AUTHZ=true (opt-in), which
    meant any deployment that forgot to set the flag silently bypassed all
    authorization checks. Flipped: any deployment that forgets to configure
    anything now stays secure.

    To disable authz (e.g. local dev without Supabase):
        AUTHZ_DISABLED=true  in your .env
    """
    return os.getenv("AUTHZ_DISABLED", "false").strip().lower() != "true"


def _is_active_org_member(user_id: str, organization_id: str) -> bool:
    q = (
        supabase.table("organization_members")
        .select("user_id")
        .eq("organization_id", organization_id)
        .eq("user_id", user_id)
        .eq("status", "active")
        .limit(1)
        .execute()
    )
    return bool(q.data)


def _has_permission(user_id: str, organization_id: str, permission_key: str) -> bool:
    q = (
        supabase.table("org_member_permissions")
        .select("enabled")
        .eq("organization_id", organization_id)
        .eq("user_id", user_id)
        .eq("permission_key", permission_key)
        .eq("enabled", True)
        .limit(1)
        .execute()
    )
    return bool(q.data)


def ensure_user_in_org(user_id: str, organization_id: str) -> None:
    """Guard: ensure user belongs to organization.

    Always enforced unless AUTHZ_DISABLED=true is explicitly set.
    """
    if not user_id or not user_id.strip():
        raise HTTPException(status_code=401, detail="Missing user_id")
    if not organization_id or not organization_id.strip():
        raise HTTPException(status_code=400, detail="Missing organization_id")
    if not _strict_authz_enabled():
        return

    try:
        if not _is_active_org_member(user_id, organization_id):
            raise HTTPException(status_code=403, detail="User is not an active member of organization")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Authorization check failed: {e}")


def ensure_permission(user_id: str, organization_id: str, permission_key: str) -> None:
    """Guard: ensure user has required permission.

    Always enforced unless AUTHZ_DISABLED=true is explicitly set.
    """
    if not user_id or not user_id.strip():
        raise HTTPException(status_code=401, detail="Missing user_id")
    if not organization_id or not organization_id.strip():
        raise HTTPException(status_code=400, detail="Missing organization_id")
    if not permission_key or not permission_key.strip():
        raise HTTPException(status_code=403, detail="Missing permission_key")
    if not _strict_authz_enabled():
        return

    try:
        if not _is_active_org_member(user_id, organization_id):
            raise HTTPException(status_code=403, detail="User is not an active member of organization")
        if not _has_permission(user_id, organization_id, permission_key):
            raise HTTPException(status_code=403, detail=f"Missing permission: {permission_key}")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Permission check failed: {e}")


def get_user_department(user_id: str, organization_id: str) -> Optional[str]:
    """Resolve user department from organization membership."""
    if not user_id or not organization_id:
        return None
    if not _strict_authz_enabled():
        return None

    try:
        q = (
            supabase.table("organization_members")
            .select("department")
            .eq("organization_id", organization_id)
            .eq("user_id", user_id)
            .eq("status", "active")
            .limit(1)
            .execute()
        )
        if q.data:
            return q.data[0].get("department")
    except Exception:
        return None

    return None