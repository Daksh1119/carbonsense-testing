-- 20260816_recommendation_quality.sql
-- Add user_rating columns to recommendation_items to support
-- the frontend thumbs-up / thumbs-down / flag feedback buttons.
-- Run this in the Supabase SQL editor before enabling the /items/{id}/rate endpoint.

BEGIN;

-- Add user-facing rating columns to recommendation_items
ALTER TABLE public.recommendation_items
  ADD COLUMN IF NOT EXISTS user_rating text
    CHECK (user_rating IN ('helpful', 'not_helpful', 'not_relevant')),
  ADD COLUMN IF NOT EXISTS rating_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS rating_updated_by uuid REFERENCES public.user_profiles(id);

COMMIT;
