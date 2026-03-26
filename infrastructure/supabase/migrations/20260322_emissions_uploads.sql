-- Emissions uploads and entries for monthly reporting.

alter table public.organization_uploads
	add column if not exists period_start date,
	add column if not exists period_end date,
	add column if not exists total_emissions_kg numeric,
	add column if not exists total_emissions_tco2e numeric,
	add column if not exists record_count integer;

-- Allow manual uploads alongside CSV/receipt/bank_statement/other.
alter table public.organization_uploads
	drop constraint if exists organization_uploads_source_type_check;

alter table public.organization_uploads
	add constraint organization_uploads_source_type_check
	check (source_type = any (array['csv'::text, 'receipt'::text, 'bank_statement'::text, 'manual'::text, 'other'::text]));

create table if not exists public.emission_entries (
	id uuid primary key default gen_random_uuid(),
	organization_id uuid not null references public.organizations(id) on delete cascade,
	upload_id uuid not null references public.organization_uploads(id) on delete cascade,
	uploaded_by uuid not null references auth.users(id) on delete restrict,
	entry_date date not null,
	category text not null,
	activity text not null,
	amount numeric not null default 0,
	unit text not null default '',
	co2_kg numeric not null default 0,
	created_at timestamptz not null default now()
);

create index if not exists idx_emission_entries_org_date
	on public.emission_entries(organization_id, entry_date desc);
create index if not exists idx_emission_entries_upload
	on public.emission_entries(upload_id, entry_date desc);
create index if not exists idx_emission_entries_category
	on public.emission_entries(category);

alter table public.organization_uploads enable row level security;
alter table public.emission_entries enable row level security;

drop policy if exists organization_uploads_select_org on public.organization_uploads;
drop policy if exists organization_uploads_insert_admin on public.organization_uploads;
drop policy if exists organization_uploads_update_admin on public.organization_uploads;
drop policy if exists organization_uploads_insert_members on public.organization_uploads;
drop policy if exists organization_uploads_update_members on public.organization_uploads;

drop policy if exists emission_entries_select_org on public.emission_entries;
drop policy if exists emission_entries_insert_admin on public.emission_entries;
drop policy if exists emission_entries_insert_members on public.emission_entries;

drop policy if exists organization_uploads_select on public.organization_uploads;
drop policy if exists organization_uploads_insert on public.organization_uploads;
drop policy if exists organization_uploads_update on public.organization_uploads;
drop policy if exists emission_entries_select on public.emission_entries;
drop policy if exists emission_entries_insert on public.emission_entries;

create policy organization_uploads_select_org
on public.organization_uploads
for select
to authenticated
using (
	exists (
		select 1
		from public.organization_members om
		where om.organization_id = organization_uploads.organization_id
			and om.user_id = auth.uid()
			and om.status = 'active'
	)
);

create policy organization_uploads_insert_members
on public.organization_uploads
for insert
to authenticated
with check (
	uploaded_by = auth.uid()
	and exists (
		select 1
		from public.organization_members om
		where om.organization_id = organization_uploads.organization_id
			and om.user_id = auth.uid()
			and om.status = 'active'
			and om.role in ('admin', 'manager', 'analyst')
	)
);

create policy organization_uploads_update_members
on public.organization_uploads
for update
to authenticated
using (
	uploaded_by = auth.uid()
	and exists (
		select 1
		from public.organization_members om
		where om.organization_id = organization_uploads.organization_id
			and om.user_id = auth.uid()
			and om.status = 'active'
			and om.role in ('admin', 'manager', 'analyst')
	)
)
with check (
	uploaded_by = auth.uid()
	and exists (
		select 1
		from public.organization_members om
		where om.organization_id = organization_uploads.organization_id
			and om.user_id = auth.uid()
			and om.status = 'active'
			and om.role in ('admin', 'manager', 'analyst')
	)
);

create policy emission_entries_select_org
on public.emission_entries
for select
to authenticated
using (
	exists (
		select 1
		from public.organization_members om
		where om.organization_id = emission_entries.organization_id
			and om.user_id = auth.uid()
			and om.status = 'active'
	)
);

create policy emission_entries_insert_members
on public.emission_entries
for insert
to authenticated
with check (
	uploaded_by = auth.uid()
	and exists (
		select 1
		from public.organization_members om
		where om.organization_id = emission_entries.organization_id
			and om.user_id = auth.uid()
			and om.status = 'active'
			and om.role in ('admin', 'manager', 'analyst')
	)
);

