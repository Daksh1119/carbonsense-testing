-- Remove inconsistent upload shells that have no linked emission entries.
-- Safe because it only targets uploads with zero child records.

delete from public.organization_uploads ou
where not exists (
  select 1
  from public.emission_entries ee
  where ee.upload_id = ou.id
);
