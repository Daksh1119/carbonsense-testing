-- 20260816_manager_approval_flow.sql
-- Transition from invite-based approved boolean to explicit approval_status enum with reviewer audits

BEGIN;

-- 1. Add new columns to public.user_profiles as nullable initially
ALTER TABLE public.user_profiles 
  ADD COLUMN IF NOT EXISTS approval_status text,
  ADD COLUMN IF NOT EXISTS reviewer_notes text,
  ADD COLUMN IF NOT EXISTS approval_reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS approval_reviewed_by uuid REFERENCES public.user_profiles(id);

-- 2. Add business_description to public.organizations
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS business_description text;

-- 3. Backfill existing user_profiles based on their previous approved status
UPDATE public.user_profiles
SET approval_status = CASE WHEN approved = true THEN 'approved' ELSE 'pending' END;

-- 4. Apply NOT NULL constraint and CHECK enum constraint to approval_status
ALTER TABLE public.user_profiles 
  ALTER COLUMN approval_status SET NOT NULL,
  ALTER COLUMN approval_status SET DEFAULT 'pending',
  ADD CONSTRAINT user_profiles_approval_status_check CHECK (approval_status IN ('pending', 'approved', 'rejected'));

-- 5. Drop the old approved boolean column
ALTER TABLE public.user_profiles DROP COLUMN approved;

COMMIT;
