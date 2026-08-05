-- ============================================================
-- CarbonSense — Role Redesign RLS Migration (002)
-- Run this in your Supabase SQL Editor AFTER 001_auth_schema.sql
--
-- Role model:
--   admin   = CarbonSense internal team (platform-ops, sees everything)
--   manager = Client company carbon lead (full CRUD on own org data)
--   viewer  = Client company employee (read-only on own org data)
-- ============================================================

-- ─────────────────────────────────────────────
-- Helper: check if current user is a platform admin
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

-- Helper: get current user's organization_id
CREATE OR REPLACE FUNCTION public.user_org_id()
RETURNS UUID
LANGUAGE sql SECURITY DEFINER STABLE
AS $$
  SELECT organization_id FROM public.user_profiles
  WHERE id = auth.uid() LIMIT 1;
$$;

-- ═════════════════════════════════════════════
-- 1. user_profiles — update existing policies
-- ═════════════════════════════════════════════
-- Drop old policies that used inline subqueries (replaced with function-based ones)
DROP POLICY IF EXISTS "user_profiles_admin_select" ON public.user_profiles;
DROP POLICY IF EXISTS "user_profiles_admin_update" ON public.user_profiles;

-- Platform admins can view ALL profiles
CREATE POLICY "user_profiles_platform_admin_select"
  ON public.user_profiles FOR SELECT
  USING (public.is_platform_admin());

-- Platform admins can update ALL profiles (approve managers, etc.)
CREATE POLICY "user_profiles_platform_admin_update"
  ON public.user_profiles FOR UPDATE
  USING (public.is_platform_admin());

-- Managers can view profiles in their own organization (for team management)
CREATE POLICY "user_profiles_manager_org_select"
  ON public.user_profiles FOR SELECT
  USING (
    organization_id = public.user_org_id()
    AND public.get_user_role(auth.uid()) IN ('manager', 'viewer')
  );

-- Managers can update viewer profiles in their org (approve employees)
CREATE POLICY "user_profiles_manager_org_update"
  ON public.user_profiles FOR UPDATE
  USING (
    organization_id = public.user_org_id()
    AND public.get_user_role(auth.uid()) = 'manager'
    AND role = 'viewer'  -- managers can only update viewers, not other managers
  );

-- ═════════════════════════════════════════════
-- 2. employee_signup_requests — add manager org policy
-- ═════════════════════════════════════════════
-- Managers can view requests for their organization
CREATE POLICY "signup_requests_manager_org_select"
  ON public.employee_signup_requests FOR SELECT
  USING (
    public.get_user_role(auth.uid()) = 'manager'
    AND organization_name = (
      SELECT organization_name FROM public.user_profiles WHERE id = auth.uid()
    )
  );

-- Managers can update (approve/reject) requests for their organization
CREATE POLICY "signup_requests_manager_update"
  ON public.employee_signup_requests FOR UPDATE
  USING (
    public.get_user_role(auth.uid()) = 'manager'
    AND organization_name = (
      SELECT organization_name FROM public.user_profiles WHERE id = auth.uid()
    )
  );

-- Platform admins can view all signup requests
CREATE POLICY "signup_requests_admin_select"
  ON public.employee_signup_requests FOR SELECT
  USING (public.is_platform_admin());

-- ═════════════════════════════════════════════
-- 3. organizations — RLS
-- ═════════════════════════════════════════════
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- Platform admins see all organizations
CREATE POLICY "organizations_admin_select"
  ON public.organizations FOR SELECT
  USING (public.is_platform_admin());

-- Platform admins can insert/update organizations
CREATE POLICY "organizations_admin_insert"
  ON public.organizations FOR INSERT
  WITH CHECK (public.is_platform_admin());

CREATE POLICY "organizations_admin_update"
  ON public.organizations FOR UPDATE
  USING (public.is_platform_admin());

-- Managers & viewers can see their own organization
CREATE POLICY "organizations_member_select"
  ON public.organizations FOR SELECT
  USING (id = public.user_org_id());

-- ═════════════════════════════════════════════
-- 4. organization_members — RLS
-- ═════════════════════════════════════════════
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

-- Platform admins see all members
CREATE POLICY "org_members_admin_select"
  ON public.organization_members FOR SELECT
  USING (public.is_platform_admin());

-- Managers see members of their org
CREATE POLICY "org_members_manager_select"
  ON public.organization_members FOR SELECT
  USING (organization_id = public.user_org_id());

-- Managers can add/update members in their org
CREATE POLICY "org_members_manager_insert"
  ON public.organization_members FOR INSERT
  WITH CHECK (
    organization_id = public.user_org_id()
    AND public.get_user_role(auth.uid()) = 'manager'
  );

CREATE POLICY "org_members_manager_update"
  ON public.organization_members FOR UPDATE
  USING (
    organization_id = public.user_org_id()
    AND public.get_user_role(auth.uid()) = 'manager'
  );

-- Viewers can see members of their org (read-only)
CREATE POLICY "org_members_viewer_select"
  ON public.organization_members FOR SELECT
  USING (
    organization_id = public.user_org_id()
    AND public.get_user_role(auth.uid()) = 'viewer'
  );

-- ═════════════════════════════════════════════
-- 5. organization_uploads — RLS
-- ═════════════════════════════════════════════
ALTER TABLE public.organization_uploads ENABLE ROW LEVEL SECURITY;

-- Platform admins see all uploads
CREATE POLICY "uploads_admin_select"
  ON public.organization_uploads FOR SELECT
  USING (public.is_platform_admin());

-- Managers can CRUD uploads for their org
CREATE POLICY "uploads_manager_select"
  ON public.organization_uploads FOR SELECT
  USING (organization_id = public.user_org_id());

CREATE POLICY "uploads_manager_insert"
  ON public.organization_uploads FOR INSERT
  WITH CHECK (
    organization_id = public.user_org_id()
    AND public.get_user_role(auth.uid()) = 'manager'
  );

CREATE POLICY "uploads_manager_update"
  ON public.organization_uploads FOR UPDATE
  USING (
    organization_id = public.user_org_id()
    AND public.get_user_role(auth.uid()) = 'manager'
  );

-- Viewers can view uploads (read-only)
CREATE POLICY "uploads_viewer_select"
  ON public.organization_uploads FOR SELECT
  USING (
    organization_id = public.user_org_id()
    AND public.get_user_role(auth.uid()) = 'viewer'
  );

-- ═════════════════════════════════════════════
-- 6. emission_entries — RLS
-- ═════════════════════════════════════════════
ALTER TABLE public.emission_entries ENABLE ROW LEVEL SECURITY;

-- Platform admins see all
CREATE POLICY "emissions_admin_select"
  ON public.emission_entries FOR SELECT
  USING (public.is_platform_admin());

-- Managers: full CRUD on own org
CREATE POLICY "emissions_manager_select"
  ON public.emission_entries FOR SELECT
  USING (organization_id = public.user_org_id());

CREATE POLICY "emissions_manager_insert"
  ON public.emission_entries FOR INSERT
  WITH CHECK (
    organization_id = public.user_org_id()
    AND public.get_user_role(auth.uid()) = 'manager'
  );

CREATE POLICY "emissions_manager_update"
  ON public.emission_entries FOR UPDATE
  USING (
    organization_id = public.user_org_id()
    AND public.get_user_role(auth.uid()) = 'manager'
  );

CREATE POLICY "emissions_manager_delete"
  ON public.emission_entries FOR DELETE
  USING (
    organization_id = public.user_org_id()
    AND public.get_user_role(auth.uid()) = 'manager'
  );

-- Viewers: read-only
CREATE POLICY "emissions_viewer_select"
  ON public.emission_entries FOR SELECT
  USING (
    organization_id = public.user_org_id()
    AND public.get_user_role(auth.uid()) = 'viewer'
  );

-- ═════════════════════════════════════════════
-- 7. compliance_requirements — RLS (global reference data)
-- ═════════════════════════════════════════════
ALTER TABLE public.compliance_requirements ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read compliance requirements (reference data)
CREATE POLICY "compliance_req_select_all"
  ON public.compliance_requirements FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Only platform admins can modify requirements
CREATE POLICY "compliance_req_admin_insert"
  ON public.compliance_requirements FOR INSERT
  WITH CHECK (public.is_platform_admin());

CREATE POLICY "compliance_req_admin_update"
  ON public.compliance_requirements FOR UPDATE
  USING (public.is_platform_admin());

-- ═════════════════════════════════════════════
-- 8. compliance_results — RLS (per-org)
-- ═════════════════════════════════════════════
ALTER TABLE public.compliance_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "compliance_results_admin_select"
  ON public.compliance_results FOR SELECT
  USING (public.is_platform_admin());

CREATE POLICY "compliance_results_org_select"
  ON public.compliance_results FOR SELECT
  USING (organization_id = public.user_org_id());

CREATE POLICY "compliance_results_manager_insert"
  ON public.compliance_results FOR INSERT
  WITH CHECK (
    organization_id = public.user_org_id()
    AND public.get_user_role(auth.uid()) = 'manager'
  );

CREATE POLICY "compliance_results_manager_update"
  ON public.compliance_results FOR UPDATE
  USING (
    organization_id = public.user_org_id()
    AND public.get_user_role(auth.uid()) = 'manager'
  );

-- ═════════════════════════════════════════════
-- 9. compliance_score_history — RLS (per-org)
-- ═════════════════════════════════════════════
ALTER TABLE public.compliance_score_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "compliance_history_admin_select"
  ON public.compliance_score_history FOR SELECT
  USING (public.is_platform_admin());

CREATE POLICY "compliance_history_org_select"
  ON public.compliance_score_history FOR SELECT
  USING (organization_id = public.user_org_id());

-- Service role inserts (computed by backend)
CREATE POLICY "compliance_history_service_insert"
  ON public.compliance_score_history FOR INSERT
  WITH CHECK (true);

-- ═════════════════════════════════════════════
-- 10. policies — RLS (global reference data)
-- ═════════════════════════════════════════════
ALTER TABLE public.policies ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read policies
CREATE POLICY "policies_select_all"
  ON public.policies FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Only platform admins can modify policies
CREATE POLICY "policies_admin_insert"
  ON public.policies FOR INSERT
  WITH CHECK (public.is_platform_admin());

CREATE POLICY "policies_admin_update"
  ON public.policies FOR UPDATE
  USING (public.is_platform_admin());

-- ═════════════════════════════════════════════
-- 11. policy_chunks — RLS (global reference data)
-- ═════════════════════════════════════════════
ALTER TABLE public.policy_chunks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "policy_chunks_select_all"
  ON public.policy_chunks FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "policy_chunks_admin_insert"
  ON public.policy_chunks FOR INSERT
  WITH CHECK (public.is_platform_admin());

-- ═════════════════════════════════════════════
-- 12. policy_interactions — RLS (per-org)
-- ═════════════════════════════════════════════
ALTER TABLE public.policy_interactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "policy_interactions_admin_select"
  ON public.policy_interactions FOR SELECT
  USING (public.is_platform_admin());

CREATE POLICY "policy_interactions_org_select"
  ON public.policy_interactions FOR SELECT
  USING (organization_id = public.user_org_id());

CREATE POLICY "policy_interactions_manager_insert"
  ON public.policy_interactions FOR INSERT
  WITH CHECK (
    organization_id = public.user_org_id()
    AND public.get_user_role(auth.uid()) = 'manager'
  );

-- ═════════════════════════════════════════════
-- 13. teme_runs — RLS
-- ═════════════════════════════════════════════
ALTER TABLE public.teme_runs ENABLE ROW LEVEL SECURITY;

-- Platform admins see all
CREATE POLICY "teme_runs_admin_select"
  ON public.teme_runs FOR SELECT
  USING (public.is_platform_admin());

-- Users can see their own runs
CREATE POLICY "teme_runs_own_select"
  ON public.teme_runs FOR SELECT
  USING (user_id = auth.uid()::text);

-- Managers can insert runs for their OWN organization only.
-- FIX: the previous policy checked role='manager' but did NOT verify that
-- the row being inserted belongs to the manager's own organization — any
-- authenticated manager from ANY org could insert a row tagged with any
-- organization_id. Now also checks organization_id = user_org_id().
CREATE POLICY "teme_runs_manager_insert"
  ON public.teme_runs FOR INSERT
  WITH CHECK (
    public.get_user_role(auth.uid()) = 'manager'
    AND organization_id = public.user_org_id()
  );


-- ═════════════════════════════════════════════
-- 14. recommendation_sessions — RLS (per-org)
-- ═════════════════════════════════════════════
ALTER TABLE public.recommendation_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rec_sessions_admin_select"
  ON public.recommendation_sessions FOR SELECT
  USING (public.is_platform_admin());

CREATE POLICY "rec_sessions_org_select"
  ON public.recommendation_sessions FOR SELECT
  USING (organization_id = public.user_org_id());

CREATE POLICY "rec_sessions_manager_insert"
  ON public.recommendation_sessions FOR INSERT
  WITH CHECK (
    organization_id = public.user_org_id()
    AND public.get_user_role(auth.uid()) = 'manager'
  );

-- ═════════════════════════════════════════════
-- 15. recommendations — RLS
-- ═════════════════════════════════════════════
ALTER TABLE public.recommendations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "recommendations_admin_select"
  ON public.recommendations FOR SELECT
  USING (public.is_platform_admin());

-- Users can see recommendations from sessions in their org
CREATE POLICY "recommendations_org_select"
  ON public.recommendations FOR SELECT
  USING (
    session_id IN (
      SELECT id FROM public.recommendation_sessions
      WHERE organization_id = public.user_org_id()
    )
  );

-- Service role inserts (generated by backend)
CREATE POLICY "recommendations_service_insert"
  ON public.recommendations FOR INSERT
  WITH CHECK (true);

CREATE POLICY "recommendations_manager_update"
  ON public.recommendations FOR UPDATE
  USING (
    public.get_user_role(auth.uid()) = 'manager'
    AND session_id IN (
      SELECT id FROM public.recommendation_sessions
      WHERE organization_id = public.user_org_id()
    )
  );

-- ═════════════════════════════════════════════
-- 16. recommendation_evidence — RLS
-- ═════════════════════════════════════════════
ALTER TABLE public.recommendation_evidence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rec_evidence_admin_select"
  ON public.recommendation_evidence FOR SELECT
  USING (public.is_platform_admin());

CREATE POLICY "rec_evidence_org_select"
  ON public.recommendation_evidence FOR SELECT
  USING (
    session_id IN (
      SELECT id FROM public.recommendation_sessions
      WHERE organization_id = public.user_org_id()
    )
  );

CREATE POLICY "rec_evidence_service_insert"
  ON public.recommendation_evidence FOR INSERT
  WITH CHECK (true);

-- ═════════════════════════════════════════════
-- 17. recommendation_feedback — RLS
-- ═════════════════════════════════════════════
ALTER TABLE public.recommendation_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rec_feedback_admin_select"
  ON public.recommendation_feedback FOR SELECT
  USING (public.is_platform_admin());

CREATE POLICY "rec_feedback_own_select"
  ON public.recommendation_feedback FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "rec_feedback_insert"
  ON public.recommendation_feedback FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- ═════════════════════════════════════════════
-- 18. recommendation_kpi_snapshots — RLS
-- ═════════════════════════════════════════════
ALTER TABLE public.recommendation_kpi_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rec_kpi_admin_select"
  ON public.recommendation_kpi_snapshots FOR SELECT
  USING (public.is_platform_admin());

CREATE POLICY "rec_kpi_org_select"
  ON public.recommendation_kpi_snapshots FOR SELECT
  USING (
    session_id IN (
      SELECT id FROM public.recommendation_sessions
      WHERE organization_id = public.user_org_id()
    )
  );

CREATE POLICY "rec_kpi_service_insert"
  ON public.recommendation_kpi_snapshots FOR INSERT
  WITH CHECK (true);


-- ═════════════════════════════════════════════
-- 20. org_member_permissions — RLS
-- ═════════════════════════════════════════════
ALTER TABLE public.org_member_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_perms_admin_select"
  ON public.org_member_permissions FOR SELECT
  USING (public.is_platform_admin());

CREATE POLICY "org_perms_manager_select"
  ON public.org_member_permissions FOR SELECT
  USING (
    organization_id = public.user_org_id()
    AND public.get_user_role(auth.uid()) = 'manager'
  );

CREATE POLICY "org_perms_manager_insert"
  ON public.org_member_permissions FOR INSERT
  WITH CHECK (
    organization_id = public.user_org_id()
    AND public.get_user_role(auth.uid()) = 'manager'
  );

CREATE POLICY "org_perms_manager_update"
  ON public.org_member_permissions FOR UPDATE
  USING (
    organization_id = public.user_org_id()
    AND public.get_user_role(auth.uid()) = 'manager'
  );

-- Own permissions (viewer can see their own)
CREATE POLICY "org_perms_own_select"
  ON public.org_member_permissions FOR SELECT
  USING (user_id = auth.uid());

-- ═════════════════════════════════════════════
-- 21. teme_recommendations — RLS
-- ═════════════════════════════════════════════
ALTER TABLE public.teme_recommendations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "teme_recs_admin_select"
  ON public.teme_recommendations FOR SELECT
  USING (public.is_platform_admin());

CREATE POLICY "teme_recs_own_select"
  ON public.teme_recommendations FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "teme_recs_service_insert"
  ON public.teme_recommendations FOR INSERT
  WITH CHECK (true);

-- ═════════════════════════════════════════════
-- 22. tree_species — RLS (global reference data)
-- ═════════════════════════════════════════════
ALTER TABLE public.tree_species ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tree_species_select_all"
  ON public.tree_species FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "tree_species_admin_insert"
  ON public.tree_species FOR INSERT
  WITH CHECK (public.is_platform_admin());

CREATE POLICY "tree_species_admin_update"
  ON public.tree_species FOR UPDATE
  USING (public.is_platform_admin());

-- ═════════════════════════════════════════════
-- 23. tree_plantings — RLS
-- ═════════════════════════════════════════════
ALTER TABLE public.tree_plantings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tree_plantings_admin_select"
  ON public.tree_plantings FOR SELECT
  USING (public.is_platform_admin());

CREATE POLICY "tree_plantings_own_select"
  ON public.tree_plantings FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "tree_plantings_service_insert"
  ON public.tree_plantings FOR INSERT
  WITH CHECK (true);

-- ═════════════════════════════════════════════
-- 24. manager_consents — add admin view
-- ═════════════════════════════════════════════
CREATE POLICY "manager_consents_admin_select"
  ON public.manager_consents FOR SELECT
  USING (public.is_platform_admin());

-- ═════════════════════════════════════════════
-- Done. Summary of role access:
--
-- ADMIN (Platform):  SELECT on everything, INSERT/UPDATE on reference data
-- MANAGER (Company): Full CRUD on own org's operational data
-- VIEWER (Employee): SELECT only on own org's data
-- SERVICE ROLE:      Bypass RLS (used by API routes for cross-cutting ops)
-- ═════════════════════════════════════════════
