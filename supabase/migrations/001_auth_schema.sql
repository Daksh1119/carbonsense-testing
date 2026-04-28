-- ============================================================
-- CarbonSense — RBAC Auth Schema Migration
-- Run this in your Supabase SQL Editor
-- ============================================================

-- ─────────────────────────────────────────────
-- 1. user_profiles
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email           TEXT NOT NULL,
  role            TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('admin', 'manager', 'viewer')),
  organization_id UUID,
  organization_name TEXT,
  first_name      TEXT,
  last_name       TEXT,
  job_title       TEXT,
  department      TEXT,
  employee_id     TEXT,
  phone           TEXT,
  avatar_url      TEXT,
  approved        BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS user_profiles_updated_at ON public.user_profiles;
CREATE TRIGGER user_profiles_updated_at
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ─────────────────────────────────────────────
-- 2. employee_signup_requests
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.employee_signup_requests (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_name TEXT,
  manager_email     TEXT,
  status            TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  form_data         JSONB,
  submitted_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at       TIMESTAMPTZ,
  reviewer_notes    TEXT
);

-- ─────────────────────────────────────────────
-- 3. manager_consents
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.manager_consents (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  consent_version   TEXT NOT NULL DEFAULT 'v1.0',
  digital_signature TEXT,
  agreed_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_address        TEXT
);

-- ─────────────────────────────────────────────
-- 4. RLS — user_profiles
-- ─────────────────────────────────────────────
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Users can view their own profile
CREATE POLICY "user_profiles_select_own"
  ON public.user_profiles FOR SELECT
  USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "user_profiles_update_own"
  ON public.user_profiles FOR UPDATE
  USING (auth.uid() = id);

-- Admins can select all profiles
CREATE POLICY "user_profiles_admin_select"
  ON public.user_profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = auth.uid() AND up.role = 'admin'
    )
  );

-- Admins can update all profiles (for approval flows)
CREATE POLICY "user_profiles_admin_update"
  ON public.user_profiles FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = auth.uid() AND up.role = 'admin'
    )
  );

-- Service role can insert (used by API routes with service key)
CREATE POLICY "user_profiles_service_insert"
  ON public.user_profiles FOR INSERT
  WITH CHECK (true);

-- ─────────────────────────────────────────────
-- 5. RLS — employee_signup_requests
-- ─────────────────────────────────────────────
ALTER TABLE public.employee_signup_requests ENABLE ROW LEVEL SECURITY;

-- Users can view their own requests
CREATE POLICY "signup_requests_select_own"
  ON public.employee_signup_requests FOR SELECT
  USING (auth.uid() = user_id);

-- Managers and admins can view all pending requests
CREATE POLICY "signup_requests_manager_select"
  ON public.employee_signup_requests FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = auth.uid() AND up.role IN ('manager', 'admin')
    )
  );

-- Service role can insert/update (via API routes)
CREATE POLICY "signup_requests_service_insert"
  ON public.employee_signup_requests FOR INSERT
  WITH CHECK (true);

CREATE POLICY "signup_requests_service_update"
  ON public.employee_signup_requests FOR UPDATE
  USING (true);

-- ─────────────────────────────────────────────
-- 6. RLS — manager_consents
-- ─────────────────────────────────────────────
ALTER TABLE public.manager_consents ENABLE ROW LEVEL SECURITY;

-- Users can view their own consents
CREATE POLICY "manager_consents_select_own"
  ON public.manager_consents FOR SELECT
  USING (auth.uid() = user_id);

-- Service role can insert
CREATE POLICY "manager_consents_service_insert"
  ON public.manager_consents FOR INSERT
  WITH CHECK (true);

-- ─────────────────────────────────────────────
-- 7. Helper: get_user_role (safe, no RLS recursion)
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_user_role(user_uuid UUID)
RETURNS TEXT
LANGUAGE sql SECURITY DEFINER
AS $$
  SELECT role FROM public.user_profiles WHERE id = user_uuid LIMIT 1;
$$;
