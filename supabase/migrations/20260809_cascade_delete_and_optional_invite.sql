-- ============================================================
-- CarbonSense — Cascade Delete & Optional Invite Migration
-- ============================================================

-- 1. Allow organization_id in manager_invites to be NULL for "New Company" invites
ALTER TABLE public.manager_invites ALTER COLUMN organization_id DROP NOT NULL;

-- 2. Create PL/pgSQL function to cascade delete an organization and all related data
CREATE OR REPLACE FUNCTION public.delete_organization_cascade(target_org_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- A. Delete task assignments and tasks
  DELETE FROM public.task_assignments WHERE organization_id = target_org_id;
  DELETE FROM public.tasks WHERE organization_id = target_org_id;

  -- B. Delete recommendations and compliance records
  DELETE FROM public.recommendations WHERE organization_id = target_org_id;
  DELETE FROM public.policy_compliance WHERE organization_id = target_org_id;

  -- C. Delete emissions records and data ingestion jobs
  DELETE FROM public.emissions_records WHERE organization_id = target_org_id;
  DELETE FROM public.data_ingestion_jobs WHERE organization_id = target_org_id;
  DELETE FROM public.facility_profiles WHERE organization_id = target_org_id;

  -- D. Delete manager invites and employee signup requests
  DELETE FROM public.manager_invites WHERE organization_id = target_org_id;
  DELETE FROM public.employee_signup_requests WHERE organization_name IN (
    SELECT name FROM public.organizations WHERE id = target_org_id
  );

  -- E. Unlink user profiles (set organization_id to NULL so users aren't orphaned DB-wise)
  UPDATE public.user_profiles 
  SET organization_id = NULL, organization_name = NULL 
  WHERE organization_id = target_org_id;

  -- F. Delete the organization record itself
  DELETE FROM public.organizations WHERE id = target_org_id;
END;
$$;
