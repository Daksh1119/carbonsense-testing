from typing import Optional
from fastapi import HTTPException


def ensure_user_in_org(user_id: str, organization_id: str) -> None:
    """
    Guard: ensure basic user/org context exists.
    TODO: wire to Supabase membership check.
    """
    if not user_id or not user_id.strip():
        raise HTTPException(status_code=401, detail="Missing user_id")
    if not organization_id or not organization_id.strip():
        raise HTTPException(status_code=400, detail="Missing organization_id")
    return


def ensure_permission(user_id: str, organization_id: str, permission_key: str) -> None:
    """
    Guard: ensure permission key is provided.
    TODO: wire to Supabase org_member_permissions check.
    """
    if not user_id or not user_id.strip():
        raise HTTPException(status_code=401, detail="Missing user_id")
    if not organization_id or not organization_id.strip():
        raise HTTPException(status_code=400, detail="Missing organization_id")
    if not permission_key or not permission_key.strip():
        raise HTTPException(status_code=403, detail="Missing permission_key")
    return


def get_user_department(user_id: str, organization_id: str) -> Optional[str]:
    """
    Temporary fallback used by OCR flow/imports.
    TODO: fetch department from org membership/profile tables in Supabase.
    """
    if not user_id or not organization_id:
        return None
    return None