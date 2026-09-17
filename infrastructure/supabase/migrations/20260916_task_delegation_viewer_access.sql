-- =============================================================================
-- CarbonSense: Task Delegation & Viewer Access Migration
-- Adds:
--   1. assigned_to column on recommendation_items (Group 5.2 task delegation)
--   2. RLS policy so viewers can read+update their own assigned tasks
--   3. RLS policy so managers can read all user_profiles in their org
--      (needed for the "Assign Employee..." dropdown on /recommendations)
--   4. target_reduction_pct on organizations (for dashboard display)
-- All statements are idempotent (IF NOT EXISTS / DO $$ guards).
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Add assigned_to to recommendation_items
--    Allows a manager to delegate a task to a specific viewer/employee.
-- ---------------------------------------------------------------------------

ALTER TABLE public.recommendation_items
  ADD COLUMN IF NOT EXISTS assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_recommendation_items_assigned_to
  ON public.recommendation_items(assigned_to)
  WHERE assigned_to IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 2. Update RLS on recommendation_items
--    Current SELECT policy requires organization_members membership.
--    Viewers are stored in user_profiles with role=''viewer'', NOT in
--    organization_members. So we need a second SELECT policy that lets
--    viewers see ONLY their own assigned tasks.
--    The UPDATE policy also needs to allow viewers to update their own tasks.
-- ---------------------------------------------------------------------------

-- Allow viewers to SELECT their own assigned tasks
DROP POLICY IF EXISTS recommendation_items_select_assigned_viewer ON public.recommendation_items;
CREATE POLICY recommendation_items_select_assigned_viewer
  ON public.recommendation_items FOR SELECT TO authenticated
  USING (
    assigned_to = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.user_profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'viewer'
        AND p.organization_id = recommendation_items.organization_id
        AND p.approval_status = 'approved'
    )
  );

-- Allow viewers to UPDATE status on their own assigned tasks
DROP POLICY IF EXISTS recommendation_items_update_assigned_viewer ON public.recommendation_items;
CREATE POLICY recommendation_items_update_assigned_viewer
  ON public.recommendation_items FOR UPDATE TO authenticated
  USING (
    assigned_to = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.user_profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'viewer'
        AND p.organization_id = recommendation_items.organization_id
        AND p.approval_status = 'approved'
    )
  );

-- ---------------------------------------------------------------------------
-- 3. Allow managers to read user_profiles for their own organization
--    Needed so the /recommendations page can list viewers to delegate to.
--    Currently user_profiles only has "own row" and "admin full access" policies.
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Managers can view org member profiles" ON public.user_profiles;
CREATE POLICY "Managers can view org member profiles"
  ON public.user_profiles FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles manager
      WHERE manager.id = auth.uid()
        AND manager.role IN ('admin', 'manager')
        AND manager.organization_id = user_profiles.organization_id
    )
  );

-- ---------------------------------------------------------------------------
-- 4. Add target_reduction_pct to organizations (displayed on manager dashboard)
-- ---------------------------------------------------------------------------

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS target_reduction_pct numeric;

-- ---------------------------------------------------------------------------
-- 5. Backfill organization_name on user_profiles from organizations table
-- ---------------------------------------------------------------------------

UPDATE public.user_profiles up
SET organization_name = o.name
FROM public.organizations o
WHERE up.organization_id = o.id
  AND (up.organization_name IS NULL OR up.organization_name = '');

COMMIT;
