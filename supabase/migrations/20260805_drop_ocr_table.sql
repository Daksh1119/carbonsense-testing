-- =============================================================================
-- Migration: Drop receipts_ocr_results table (OCR feature removed)
-- =============================================================================
-- The OCR / food-receipt scanning feature has been discontinued.
-- This migration drops the receipts_ocr_results table and all its
-- associated policies from the live database.
--
-- Run this in the Supabase SQL Editor.
-- =============================================================================

-- Drop policies first (CASCADE handles this, but being explicit is cleaner)
DROP POLICY IF EXISTS "ocr_admin_select"    ON public.receipts_ocr_results;
DROP POLICY IF EXISTS "ocr_org_select"      ON public.receipts_ocr_results;
DROP POLICY IF EXISTS "ocr_manager_insert"  ON public.receipts_ocr_results;

-- Drop the table (CASCADE removes any foreign key references)
DROP TABLE IF EXISTS public.receipts_ocr_results CASCADE;
