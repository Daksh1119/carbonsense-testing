from typing import Optional


def ensure_user_in_org(user_id: str, organization_id: str) -> None:
    """
    Temporary no-op for local endpoint boot.
    TODO: wire to Supabase membership check.
    """
    return


def ensure_permission(user_id: str, organization_id: str, permission_key: str) -> None:
    """
    Temporary no-op for local endpoint boot.
    TODO: wire to Supabase org_member_permissions check.
    """
    return


def get_user_department(user_id: str, organization_id: str) -> Optional[str]:
    """
    Temporary fallback used by OCR flow/imports.
    TODO: fetch department from org membership/profile tables in Supabase.
    """
    return None