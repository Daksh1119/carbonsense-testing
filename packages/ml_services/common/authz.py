import os
import time
from typing import Optional
from fastapi import HTTPException

from ml_services.common.supabase_client import supabase

# ---------------------------------------------------------------------------
# In-process TTL cache for authorization checks.
# Avoids 2-4 Supabase round-trips per API request for the same user/org pair.
# TTL: 60 seconds — short enough to catch role changes, long enough to batch
# all the parallel requests the dashboard fires on load.
# ---------------------------------------------------------------------------
_authz_cache: dict[str, tuple[bool, float]] = {}
_AUTHZ_CACHE_TTL = 60.0  # seconds


def _cache_key(user_id: str, organization_id: str, suffix: str = "") -> str:
    return f"{user_id}:{organization_id}:{suffix}"


def _cache_get(key: str) -> bool | None:
    entry = _authz_cache.get(key)
    if entry is None:
        return None
    value, expires_at = entry
    if time.monotonic() > expires_at:
        del _authz_cache[key]
        return None
    return value


def _cache_set(key: str, value: bool) -> None:
    _authz_cache[key] = (value, time.monotonic() + _AUTHZ_CACHE_TTL)


def _strict_authz_enabled() -> bool:
    """
    Authz is ENABLED BY DEFAULT — explicitly opt-out with AUTHZ_DISABLED=true.

    Rationale: "secure by default" is the correct fail-safe direction.
    To disable authz (e.g. local dev without Supabase):
        AUTHZ_DISABLED=true  in your .env
    """
    return os.getenv("AUTHZ_DISABLED", "false").strip().lower() != "true"


def _is_active_org_member(user_id: str, organization_id: str) -> bool:
    cache_key = _cache_key(user_id, organization_id, "member")
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached

    result = False
    try:
        q_profile = (
            supabase.table("user_profiles")
            .select("id")
            .eq("id", user_id)
            .eq("organization_id", organization_id)
            .limit(1)
            .execute()
        )
        if q_profile.data:
            result = True
    except Exception:
        pass

    if not result:
        try:
            q_members = (
                supabase.table("organization_members")
                .select("user_id")
                .eq("organization_id", organization_id)
                .eq("user_id", user_id)
                .limit(1)
                .execute()
            )
            if q_members.data:
                result = True
        except Exception:
            pass

    _cache_set(cache_key, result)
    return result


def _has_permission(user_id: str, organization_id: str, permission_key: str) -> bool:
    cache_key = _cache_key(user_id, organization_id, f"perm:{permission_key}")
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached

    result = False
    try:
        q_profile = (
            supabase.table("user_profiles")
            .select("role")
            .eq("id", user_id)
            .eq("organization_id", organization_id)
            .limit(1)
            .execute()
        )
        if q_profile.data:
            role = q_profile.data[0].get("role")
            if role in ("manager", "admin"):
                result = True
    except Exception:
        pass

    if not result:
        try:
            q_perm = (
                supabase.table("org_member_permissions")
                .select("enabled")
                .eq("organization_id", organization_id)
                .eq("user_id", user_id)
                .eq("permission_key", permission_key)
                .eq("enabled", True)
                .limit(1)
                .execute()
            )
            if q_perm.data:
                result = True
        except Exception:
            pass

    if not result:
        result = _is_active_org_member(user_id, organization_id)

    _cache_set(cache_key, result)
    return result


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