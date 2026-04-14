-- Improve lookup performance for user-scoped upload fallbacks in frontend APIs.

create index if not exists idx_organization_uploads_uploaded_by_created_at
  on public.organization_uploads(uploaded_by, created_at desc);

create index if not exists idx_emission_entries_uploaded_by_upload_date
  on public.emission_entries(uploaded_by, upload_id, entry_date desc);
