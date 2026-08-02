-- =============================================================================
-- Migration: Add organization_id to teme_runs + fix cross-tenant RLS
-- =============================================================================
-- CONTEXT: teme_runs was created with only user_id (text), no organization_id.
-- The 002_role_redesign_rls.sql migration referenced organization_id but the
-- column did not exist, causing ERROR 42703 when running the policy.
--
-- This migration:
--   1. Adds organization_id (uuid, nullable) to teme_runs
--   2. Backfills organization_id from user_profiles where possible
--   3. Replaces the old permissive insert policy with one that enforces
--      the manager's own organization
--
-- Run this in the Supabase SQL Editor.
-- =============================================================================

-- Step 1: Add organization_id column if it doesn't already exist
ALTER TABLE public.teme_runs
  ADD COLUMN IF NOT EXISTS organization_id uuid
  REFERENCES public.organizations(id) ON DELETE SET NULL;

-- Step 2: Backfill organization_id from user_profiles for existing rows
-- (best-effort; rows where user_id doesn't match any profile stay NULL)
UPDATE public.teme_runs tr
SET organization_id = up.organization_id
FROM public.user_profiles up
WHERE tr.user_id = up.id::text
  AND tr.organization_id IS NULL;

-- Step 3: Create index for the new column
CREATE INDEX IF NOT EXISTS idx_teme_runs_org
  ON public.teme_runs(organization_id);

-- Step 4: Drop all old teme_runs insert policies (both the one from
-- teme_runs.sql and the one from 002_role_redesign_rls.sql)
DROP POLICY IF EXISTS "teme_runs_manager_insert" ON public.teme_runs;
DROP POLICY IF EXISTS "Users can insert TEME runs" ON public.teme_runs;
DROP POLICY IF EXISTS "Users can read TEME runs" ON public.teme_runs;

-- Step 5: Recreate RLS policies scoped to the user's organization
-- Read: users can read their own runs only
CREATE POLICY "teme_runs_own_select"
  ON public.teme_runs FOR SELECT
  USING (user_id = auth.uid()::text);

-- Read: platform admins see all
CREATE POLICY "teme_runs_admin_select"
  ON public.teme_runs FOR SELECT
  USING (public.is_platform_admin());

-- Insert: managers can only insert into their own organization
-- Both the user_id and organization_id must match the authenticated caller.
CREATE POLICY "teme_runs_manager_insert"
  ON public.teme_runs FOR INSERT
  WITH CHECK (
    user_id = auth.uid()::text
    AND organization_id = public.user_org_id()
  );
