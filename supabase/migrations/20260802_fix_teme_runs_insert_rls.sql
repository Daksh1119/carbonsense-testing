-- =============================================================================
-- Migration: Add organization_id to teme_runs + fix cross-tenant RLS
-- Safe to re-run: uses IF NOT EXISTS / OR REPLACE / IF EXISTS throughout.
-- =============================================================================

-- Step 1: Add organization_id column (safe, idempotent)
ALTER TABLE public.teme_runs
  ADD COLUMN IF NOT EXISTS organization_id uuid
  REFERENCES public.organizations(id) ON DELETE SET NULL;

-- Step 2: Backfill organization_id from user_profiles for existing rows
UPDATE public.teme_runs tr
SET organization_id = up.organization_id
FROM public.user_profiles up
WHERE tr.user_id = up.id::text
  AND tr.organization_id IS NULL;

-- Step 3: Index (safe, idempotent)
CREATE INDEX IF NOT EXISTS idx_teme_runs_org
  ON public.teme_runs(organization_id);

-- Step 4: Drop ALL existing teme_runs policies before recreating cleanly
DROP POLICY IF EXISTS "teme_runs_manager_insert"    ON public.teme_runs;
DROP POLICY IF EXISTS "teme_runs_own_select"         ON public.teme_runs;
DROP POLICY IF EXISTS "teme_runs_admin_select"        ON public.teme_runs;
DROP POLICY IF EXISTS "Users can insert TEME runs"    ON public.teme_runs;
DROP POLICY IF EXISTS "Users can read TEME runs"      ON public.teme_runs;

-- Step 5: Recreate all policies cleanly
-- Users can read only their own runs
CREATE POLICY "teme_runs_own_select"
  ON public.teme_runs FOR SELECT
  USING (user_id = auth.uid()::text);

-- Platform admins see all runs
CREATE POLICY "teme_runs_admin_select"
  ON public.teme_runs FOR SELECT
  USING (public.is_platform_admin());

-- Managers can insert into their OWN organization only
-- (user_id must match caller, organization_id must match caller's org)
CREATE POLICY "teme_runs_manager_insert"
  ON public.teme_runs FOR INSERT
  WITH CHECK (
    user_id = auth.uid()::text
    AND organization_id = public.user_org_id()
  );
