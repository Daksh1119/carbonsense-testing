-- Migration: Create receipts_ocr_results table
CREATE TABLE IF NOT EXISTS public.receipts_ocr_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    employee_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    employee_department TEXT,
    source_file_name TEXT,
    ocr_text TEXT,
    ocr_method TEXT,
    vendor TEXT,
    receipt_date DATE,
    total_amount NUMERIC(12, 2),
    currency TEXT DEFAULT 'INR',
    ocr_confidence NUMERIC(5, 4),
    carbon_total_kg NUMERIC(12, 4),
    mapped_items JSONB,
    status TEXT DEFAULT 'processed',
    processed_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.receipts_ocr_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ocr_admin_select"
  ON public.receipts_ocr_results FOR SELECT
  USING (public.is_platform_admin());

CREATE POLICY "ocr_org_select"
  ON public.receipts_ocr_results FOR SELECT
  USING (organization_id = public.user_org_id());
