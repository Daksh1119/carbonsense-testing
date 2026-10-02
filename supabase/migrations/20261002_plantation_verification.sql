-- ============================================================
-- CarbonSense — Plantation Verification Migration
-- Date: 2026-10-02
-- Tables added: plantation_sites, plantation_reports,
--   plantation_report_photos, plantation_report_flags,
--   plantation_imagery_snapshots  (27 total after this file)
-- ============================================================

-- ─────────────────────────────────────────────
-- 0. Extensions
-- ─────────────────────────────────────────────
create extension if not exists pg_trgm;

-- ─────────────────────────────────────────────
-- 1. plantation_sites
-- ─────────────────────────────────────────────
create table public.plantation_sites (
  id                uuid        primary key default gen_random_uuid(),
  org_id            uuid        not null references public.organizations(id) on delete cascade,
  -- Optional: link to the TEME run that originated this site (nullable, set null on delete)
  teme_run_id       text        null,   -- teme_runs.user_id is TEXT so we store the run id as text ref; no FK to avoid type mismatch
  recommendation_id uuid        null,   -- optional link to recommendations
  name              text        not null check (char_length(name) between 2 and 120),
  latitude          double precision not null check (latitude  between -90  and 90),
  longitude         double precision not null check (longitude between -180 and 180),
  area_hectares     numeric(12,4) not null check (area_hectares > 0 and area_hectares <= 50000),
  boundary_geojson  jsonb       null,
  target_trees      integer     null check (target_trees >= 0),
  region_label      text        null,
  status            text        not null default 'active'
                    check (status in ('active','completed','archived')),
  created_by        uuid        not null references auth.users(id),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index plantation_sites_org_idx on public.plantation_sites (org_id);
create index plantation_sites_name_trgm_idx on public.plantation_sites using gin (name gin_trgm_ops);

-- ─────────────────────────────────────────────
-- 2. plantation_reports
-- ─────────────────────────────────────────────
create table public.plantation_reports (
  id                          uuid        primary key default gen_random_uuid(),
  org_id                      uuid        not null references public.organizations(id) on delete cascade,
  site_id                     uuid        not null references public.plantation_sites(id) on delete cascade,
  submitted_by                uuid        not null references auth.users(id),
  submitted_at                timestamptz not null default now(),
  -- Period
  period_label                text        not null,   -- e.g. 'FY2026-27-Q2'
  period_start                date        not null,
  period_end                  date        not null,
  is_interim                  boolean     not null default false,
  -- Immutable snapshot of site coordinates at submit time
  latitude                    double precision not null,
  longitude                   double precision not null,
  area_hectares               numeric(12,4) not null,
  -- Planting data
  planting_start_date         date        not null,
  planting_end_date           date        not null check (planting_end_date >= planting_start_date),
  trees_planted_this_period   integer     not null check (trees_planted_this_period >= 0),
  trees_planted_cumulative    integer     not null check (trees_planted_cumulative >= trees_planted_this_period),
  -- Species: [{name: "Neem", count: 120}]
  species                     jsonb       not null,
  survival_rate_pct           numeric(5,2) null check (survival_rate_pct between 0 and 100),
  planting_method             text        null
                              check (planting_method in ('nursery_saplings','direct_seeding','miyawaki_dense','other')),
  implementing_partner        text        null check (char_length(implementing_partner) <= 120),
  maintenance_activities      text[]      null,
  notes                       text        null check (char_length(notes) <= 1000),
  declaration_accepted        boolean     not null check (declaration_accepted),
  -- Review (admin only via RPC)
  review_status               text        not null default 'pending'
                              check (review_status in ('pending','reviewed','needs_attention')),
  reviewed_by                 uuid        null references auth.users(id),
  reviewed_at                 timestamptz null,
  admin_note                  text        null check (char_length(admin_note) <= 1000),
  -- Imagery job status
  imagery_status              text        not null default 'pending'
                              check (imagery_status in ('pending','ready','failed','skipped'))
);
create index plantation_reports_org_at_idx  on public.plantation_reports (org_id, submitted_at desc);
create index plantation_reports_at_idx      on public.plantation_reports (submitted_at desc);
create index plantation_reports_site_idx    on public.plantation_reports (site_id, submitted_at desc);
create index plantation_reports_status_idx  on public.plantation_reports (review_status);

-- ─────────────────────────────────────────────
-- 3. plantation_report_photos
-- ─────────────────────────────────────────────
create table public.plantation_report_photos (
  id                   uuid        primary key default gen_random_uuid(),
  report_id            uuid        not null references public.plantation_reports(id) on delete cascade,
  org_id               uuid        not null references public.organizations(id) on delete cascade,
  storage_path         text        not null,  -- '{org_id}/{site_id}/{report_id}/{uuid}.jpg'
  sha256               text        not null,
  caption              text        null check (char_length(caption) <= 140),
  gps_lat              double precision null,
  gps_lng              double precision null,
  gps_source           text        null check (gps_source in ('exif','device','none')),
  taken_at             timestamptz null,
  distance_from_site_m integer     null,      -- haversine, computed server-side
  created_at           timestamptz not null default now()
);
create index plantation_photos_report_idx on public.plantation_report_photos (report_id);
create index plantation_photos_sha256_idx on public.plantation_report_photos (sha256);

-- ─────────────────────────────────────────────
-- 4. plantation_report_flags
-- ─────────────────────────────────────────────
create table public.plantation_report_flags (
  id                   uuid        primary key default gen_random_uuid(),
  report_id            uuid        not null references public.plantation_reports(id) on delete cascade,
  org_id               uuid        not null references public.organizations(id) on delete cascade,
  code                 text        not null,
  severity             text        not null check (severity in ('info','warn','alert')),
  detail               jsonb       not null default '{}',
  visible_to_manager   boolean     not null default true,  -- false for OVERLAPS_OTHER_ORG
  created_at           timestamptz not null default now()
);
create index plantation_flags_report_idx on public.plantation_report_flags (report_id);

-- ─────────────────────────────────────────────
-- 5. plantation_imagery_snapshots
-- ─────────────────────────────────────────────
create table public.plantation_imagery_snapshots (
  id            uuid        primary key default gen_random_uuid(),
  report_id     uuid        not null references public.plantation_reports(id) on delete cascade,
  site_id       uuid        not null references public.plantation_sites(id) on delete cascade,
  org_id        uuid        not null references public.organizations(id) on delete cascade,
  provider      text        not null default 'cdse_sentinel2',
  scene_date    date        null,
  cloud_pct     numeric(5,2) null,
  image_path    text        null,  -- storage path in plantation-imagery bucket
  ndvi_series   jsonb       null,  -- [{from, to, mean, sample_count}]
  status        text        not null check (status in ('ready','failed','skipped')),
  error_message text        null,
  fetched_at    timestamptz not null default now()
);
create index plantation_imagery_report_idx on public.plantation_imagery_snapshots (report_id, fetched_at desc);

-- ─────────────────────────────────────────────
-- 6. RLS — enable on all five tables
-- ─────────────────────────────────────────────
alter table public.plantation_sites             enable row level security;
alter table public.plantation_reports           enable row level security;
alter table public.plantation_report_photos     enable row level security;
alter table public.plantation_report_flags      enable row level security;
alter table public.plantation_imagery_snapshots enable row level security;

-- plantation_sites policies
create policy plantation_sites_mgr_select on public.plantation_sites
  for select using (
    get_user_role(auth.uid()) = 'manager'
    and org_id = user_org_id()
  );

create policy plantation_sites_mgr_insert on public.plantation_sites
  for insert with check (
    get_user_role(auth.uid()) = 'manager'
    and org_id = user_org_id()
    and created_by = auth.uid()
  );

create policy plantation_sites_mgr_update on public.plantation_sites
  for update
  using  (get_user_role(auth.uid()) = 'manager' and org_id = user_org_id())
  with check (org_id = user_org_id());

create policy plantation_sites_admin_select on public.plantation_sites
  for select using (is_platform_admin());

-- plantation_reports policies — NO update/delete for managers; admin read only
create policy plantation_reports_mgr_select on public.plantation_reports
  for select using (
    get_user_role(auth.uid()) = 'manager'
    and org_id = user_org_id()
  );

create policy plantation_reports_mgr_insert on public.plantation_reports
  for insert with check (
    get_user_role(auth.uid()) = 'manager'
    and org_id = user_org_id()
    and submitted_by = auth.uid()
  );

create policy plantation_reports_admin_select on public.plantation_reports
  for select using (is_platform_admin());

-- photos — select only (service role writes from FastAPI)
create policy plantation_photos_mgr_select on public.plantation_report_photos
  for select using (
    get_user_role(auth.uid()) = 'manager'
    and org_id = user_org_id()
  );

create policy plantation_photos_admin_select on public.plantation_report_photos
  for select using (is_platform_admin());

-- imagery snapshots — select only
create policy plantation_imagery_mgr_select on public.plantation_imagery_snapshots
  for select using (
    get_user_role(auth.uid()) = 'manager'
    and org_id = user_org_id()
  );

create policy plantation_imagery_admin_select on public.plantation_imagery_snapshots
  for select using (is_platform_admin());

-- flags — manager sees only visible_to_manager rows; admin sees all
create policy plantation_flags_mgr_select on public.plantation_report_flags
  for select using (
    get_user_role(auth.uid()) = 'manager'
    and org_id = user_org_id()
    and visible_to_manager = true
  );

create policy plantation_flags_admin_select on public.plantation_report_flags
  for select using (is_platform_admin());

-- ─────────────────────────────────────────────
-- 7. Coordinate lock trigger (updated_at + immutability guard)
-- ─────────────────────────────────────────────
create or replace function public.plantation_sites_guard()
returns trigger language plpgsql as $$
begin
  -- Auto-update updated_at on any update
  new.updated_at := now();

  -- Reject org_id changes (immutable)
  if new.org_id <> old.org_id then
    raise exception 'plantation_sites.org_id is immutable';
  end if;

  -- Reject coordinate / area changes once a report exists
  if (new.latitude, new.longitude, new.area_hectares) is distinct from
     (old.latitude, old.longitude, old.area_hectares)
     and exists (
       select 1 from public.plantation_reports r where r.site_id = old.id limit 1
     )
  then
    raise exception 'Site location and area are locked once a report exists. Create a new site for a different location.';
  end if;

  return new;
end $$;

create trigger trg_plantation_sites_guard
  before update on public.plantation_sites
  for each row execute function public.plantation_sites_guard();

-- ─────────────────────────────────────────────
-- 8. Admin review RPC (the ONLY way to set review fields)
-- ─────────────────────────────────────────────
create or replace function public.review_plantation_report(
  p_report_id uuid,
  p_status    text,
  p_note      text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Only admins may call this
  if get_user_role(auth.uid()) <> 'admin' then
    raise exception 'forbidden: only admins can review plantation reports';
  end if;

  -- Validate status value
  if p_status not in ('pending', 'reviewed', 'needs_attention') then
    raise exception 'invalid status: must be pending, reviewed, or needs_attention';
  end if;

  update public.plantation_reports
     set review_status = p_status,
         admin_note    = case when p_note is not null then left(p_note, 1000) else admin_note end,
         reviewed_by   = auth.uid(),
         reviewed_at   = now()
   where id = p_report_id;
end $$;

revoke all on function public.review_plantation_report(uuid, text, text) from public, anon;
grant execute on function public.review_plantation_report(uuid, text, text) to authenticated;

-- ─────────────────────────────────────────────
-- 9. Admin read view (security_invoker so RLS applies)
-- ─────────────────────────────────────────────
create view public.plantation_reports_admin_v
with (security_invoker = true) as
select
  r.*,
  o.name                                                      as org_name,
  s.name                                                      as site_name,
  s.target_trees,
  (select count(*) from public.plantation_report_photos p
   where p.report_id = r.id)                                  as photo_count,
  (select count(*) from public.plantation_report_flags f
   where f.report_id = r.id and f.severity in ('warn','alert')) as flag_count
from public.plantation_reports r
join public.organizations       o on o.id = r.org_id
join public.plantation_sites    s on s.id = r.site_id;

-- ─────────────────────────────────────────────
-- 10. Trigram index on organizations.name for admin search
-- ─────────────────────────────────────────────
create index if not exists organizations_name_trgm_idx
  on public.organizations using gin (name gin_trgm_ops);

-- ─────────────────────────────────────────────
-- NOTE: Storage buckets (plantation-proofs, plantation-imagery) and
-- storage RLS policies must be created via the Supabase Dashboard or
-- management API — SQL-level storage policy syntax is not portable.
-- See docs/plantation_verification.md for bucket setup instructions.
-- ─────────────────────────────────────────────
