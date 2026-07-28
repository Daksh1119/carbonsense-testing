-- CarbonSense — Migration: Extend organizations table for settings page
-- Adds industry, size, country columns + manager UPDATE policy
-- Run in Supabase SQL Editor AFTER the existing migrations

-- 1. Add columns (idempotent with IF NOT EXISTS equivalents via DO block)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'organizations' AND column_name = 'industry'
  ) THEN
    ALTER TABLE public.organizations ADD COLUMN industry text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'organizations' AND column_name = 'size'
  ) THEN
    ALTER TABLE public.organizations ADD COLUMN size text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'organizations' AND column_name = 'country'
  ) THEN
    ALTER TABLE public.organizations ADD COLUMN country text;
  END IF;
END $$;

-- 2. Manager UPDATE policy — allows managers to update their own org's name/industry/size/country
-- (Admins already have full UPDATE via organizations_admin_update)
DROP POLICY IF EXISTS "organizations_manager_update" ON public.organizations;
CREATE POLICY "organizations_manager_update"
  ON public.organizations FOR UPDATE
  USING (
    id = public.user_org_id()
    AND public.get_user_role(auth.uid()) = 'manager'
  )
  WITH CHECK (
    id = public.user_org_id()
    AND public.get_user_role(auth.uid()) = 'manager'
  );
