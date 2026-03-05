from typing import Dict, Any
from fastapi import HTTPException
from ml_services.common.supabase_client import supabase


def ensure_user_in_org(user_id: str, organization_id: str) -> None:
    q = (
        supabase.table("organization_members")
        .select("user_id,organization_id,status")
        .eq("user_id", user_id)
        .eq("organization_id", organization_id)
        .eq("status", "active")
        .limit(1)
        .execute()
    )
    if not q.data:
        raise HTTPException(status_code=403, detail="User is not active in this organization")


def ensure_permission(user_id: str, organization_id: str, permission: str) -> None:
    # Assumes materialized per-user permissions in org_member_permissions table
    q = (
        supabase.table("org_member_permissions")
        .select("permission_key")
        .eq("user_id", user_id)
        .eq("organization_id", organization_id)
        .eq("permission_key", permission)
        .limit(1)
        .execute()
    )
    if not q.data:
        raise HTTPException(status_code=403, detail=f"Missing permission: {permission}")


def get_user_department(user_id: str, organization_id: str) -> str:
    q = (
        supabase.table("organization_members")
        .select("department")
        .eq("user_id", user_id)
        .eq("organization_id", organization_id)
        .limit(1)
        .execute()
    )
    if not q.data:
        return "unassigned"
    return q.data[0].get("department") or "unassigned"