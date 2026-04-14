-- Policy & compliance enhancement fields for policy matching and guided workflows

alter table if exists public.policies
    add column if not exists match_reason text,
    add column if not exists document_summary jsonb,
    add column if not exists steps jsonb,
    add column if not exists funding jsonb,
    add column if not exists match_score integer default 0;

alter table if exists public.compliance_results
    add column if not exists step_progress jsonb;
