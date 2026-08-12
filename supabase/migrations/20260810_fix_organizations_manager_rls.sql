-- =============================================================================
-- Migration: Add manager INSERT & UPDATE policies for public.organizations
-- Safe to re-run: uses IF EXISTS / DROP POLICY IF EXISTS throughout.
-- =============================================================================

-- Step 1: Drop existing manager policies on organizations if any
DROP POLICY IF EXISTS "organizations_manager_insert" ON public.organizations;
DROP POLICY IF EXISTS "organizations_manager_update" ON public.organizations;

-- Step 2: Allow authenticated managers to insert a new organization (for onboarding setup)
CREATE POLICY "organizations_manager_insert"
  ON public.organizations FOR INSERT
  WITH CHECK (
    auth.role() = 'authenticated'
    AND (
      public.get_user_role(auth.uid()) IN ('manager', 'admin')
      OR public.is_platform_admin()
    )
  );

-- Step 3: Allow managers to update their own organization row
CREATE POLICY "organizations_manager_update"
  ON public.organizations FOR UPDATE
  USING (
    id = public.user_org_id()
    OR public.is_platform_admin()
  );
