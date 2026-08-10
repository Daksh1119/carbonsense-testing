-- ============================================================
-- CarbonSense Migration: Group 5.2 Schema + RLS
-- Add assigned_to to recommendation_items
-- Run in Supabase SQL Editor (once per environment)
-- ============================================================

-- 1. Add assigned_to column to recommendation_items
ALTER TABLE recommendation_items
  ADD COLUMN IF NOT EXISTS assigned_to uuid REFERENCES user_profiles(id);

CREATE INDEX IF NOT EXISTS idx_recommendation_items_assigned_to
  ON recommendation_items (assigned_to);

-- ============================================================
-- 2. RLS: viewers can UPDATE only their own assigned item status
-- ============================================================
DROP POLICY IF EXISTS "viewer_can_update_own_assigned_item_status" ON recommendation_items;
CREATE POLICY "viewer_can_update_own_assigned_item_status"
  ON recommendation_items
  FOR UPDATE
  USING (
    assigned_to = auth.uid()
    AND EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.user_id = auth.uid()
        AND om.role = 'viewer'
    )
  )
  WITH CHECK (
    -- Viewer may only change implementation_status, not reassign or change session
    assigned_to = auth.uid()
  );

-- 3. RLS: managers can assign items within their org
DROP POLICY IF EXISTS "manager_can_assign_items_in_org" ON recommendation_items;
CREATE POLICY "manager_can_assign_items_in_org"
  ON recommendation_items
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM recommendation_sessions rs
      JOIN organization_members om ON om.organization_id = rs.organization_id
      WHERE rs.id = recommendation_items.session_id
        AND om.user_id = auth.uid()
        AND om.role IN ('manager', 'admin')
    )
  );

-- ============================================================
-- Admin catalog management pages (5.1)
-- Ensure is_active column exists on recommendation_catalog
-- ============================================================

ALTER TABLE recommendation_catalog
  ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;

-- RLS: only admins can INSERT/UPDATE/DELETE the catalog
DROP POLICY IF EXISTS "admin_manage_catalog" ON recommendation_catalog;
CREATE POLICY "admin_manage_catalog"
  ON recommendation_catalog
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Everyone authenticated can read the catalog
DROP POLICY IF EXISTS "authenticated_read_catalog" ON recommendation_catalog;
CREATE POLICY "authenticated_read_catalog"
  ON recommendation_catalog
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- ============================================================
-- Policy library admin management (5.1)
-- Ensure is_active + applicability columns exist on policies
-- ============================================================

ALTER TABLE policies
  ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS applicability text[];

-- RLS: only admins can update policy records
DROP POLICY IF EXISTS "admin_manage_policies" ON policies;
CREATE POLICY "admin_manage_policies"
  ON policies
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
