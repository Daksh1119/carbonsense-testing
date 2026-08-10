-- ============================================================
-- CarbonSense: manager_invites table
-- Admin creates an invite row → user signs up → auto-gets manager role
-- Run in Supabase SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS public.manager_invites (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  invited_by      UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  email           TEXT NOT NULL,
  role            TEXT NOT NULL DEFAULT 'manager'
                    CHECK (role IN ('manager', 'viewer')),
  status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'accepted', 'expired', 'cancelled')),
  token           UUID NOT NULL DEFAULT gen_random_uuid(),
  expires_at      TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '7 days',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  accepted_at     TIMESTAMPTZ,
  notes           TEXT
);

CREATE INDEX IF NOT EXISTS idx_manager_invites_email     ON public.manager_invites (email);
CREATE INDEX IF NOT EXISTS idx_manager_invites_org       ON public.manager_invites (organization_id);
CREATE INDEX IF NOT EXISTS idx_manager_invites_status    ON public.manager_invites (status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_manager_invites_token ON public.manager_invites (token);

-- RLS
ALTER TABLE public.manager_invites ENABLE ROW LEVEL SECURITY;

-- Admins can do everything on their org's invites
DROP POLICY IF EXISTS "admin_manage_invites" ON public.manager_invites;
CREATE POLICY "admin_manage_invites"
  ON public.manager_invites
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Service role (used by API routes) can update to mark accepted
DROP POLICY IF EXISTS "service_update_invites" ON public.manager_invites;
CREATE POLICY "service_update_invites"
  ON public.manager_invites
  FOR UPDATE
  USING (true);

-- Auto-expire invites older than 7 days (run nightly via cron or on-demand)
-- UPDATE manager_invites SET status = 'expired'
-- WHERE status = 'pending' AND expires_at < NOW();
