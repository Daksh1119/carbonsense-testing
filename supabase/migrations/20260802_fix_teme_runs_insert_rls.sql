-- =============================================================================
-- Migration: Fix teme_runs_manager_insert RLS cross-tenant injection gap
-- =============================================================================
-- PROBLEM: The original policy only checked role='manager' but never verified
-- that the row being inserted belongs to the manager's own organization.
-- Any authenticated manager from ANY org could insert a teme_runs row tagged
-- with any organization_id they chose.
--
-- FIX: Also require organization_id = user_org_id() (the caller's own org,
-- resolved via auth.uid() from user_profiles).
--
-- Run this in the Supabase SQL Editor or via supabase db push.
-- =============================================================================

DROP POLICY IF EXISTS "teme_runs_manager_insert" ON public.teme_runs;

CREATE POLICY "teme_runs_manager_insert"
  ON public.teme_runs FOR INSERT
  WITH CHECK (
    public.get_user_role(auth.uid()) = 'manager'
    AND organization_id = public.user_org_id()
  );
