-- Safety-oriented hard delete helper for uploads.
-- Deletes one upload in-org and relies on FK cascade for emission_entries.
-- Use this when you need controlled SQL-side permanent deletion.

create or replace function public.safe_delete_organization_upload(
  p_upload_id uuid,
  p_organization_id uuid,
  p_user_id uuid default null
)
returns table(deleted_upload_id uuid, cascade_deleted_emission_entries boolean)
language plpgsql
security definer
as $$
declare
  v_upload_id uuid;
begin
  select ou.id
  into v_upload_id
  from public.organization_uploads ou
  where ou.id = p_upload_id
    and ou.organization_id = p_organization_id
    and (p_user_id is null or ou.uploaded_by = p_user_id)
  limit 1;

  if v_upload_id is null then
    raise exception 'Upload not found for provided scope';
  end if;

  -- ON DELETE CASCADE removes rows from public.emission_entries.
  delete from public.organization_uploads ou
  where ou.id = v_upload_id
    and ou.organization_id = p_organization_id;

  return query
  select v_upload_id, true;
end;
$$;

comment on function public.safe_delete_organization_upload(uuid, uuid, uuid)
  is 'Safely hard-deletes one organization upload and cascades linked emission entries.';
