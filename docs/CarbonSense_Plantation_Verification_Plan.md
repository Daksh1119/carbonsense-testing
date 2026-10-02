# CarbonSense: Plantation Verification Feature: Implementation Plan

> **Audience:** the AI coding agent that will build this feature.
> **Status:** approved plan, ready to implement. Date: 2026-10-02.
> **Rule zero:** follow the repo's existing conventions. Where this plan names a file, table, helper or route that you cannot find in the repo, **find the closest existing equivalent and use it. Do not invent a parallel pattern.** Anything marked `VERIFY` must be checked in the code before you rely on it.

---

## 0. Agent operating rules

1. **Phase 0 is read-only.** Complete Section 14, Phase 0 before writing any code or SQL.
2. **Do not add colors, fonts, spacing scales, or component styles.** Reuse the platform's existing components and tokens (Section 11).
3. **Never trust `org_id` from the client.** Derive it from the authenticated user's profile on the server.
4. **Reports are immutable once submitted.** No UPDATE/DELETE policies for managers. Corrections are new reports.
5. **Admin cannot edit company data.** The platform principle is that admins oversee but do not modify client operational data. Admin may only set review fields, via a single RPC (Section 8.4).
6. **No new dependency without checking it is not already installed.** Proposed new dependencies are listed in Section 13.
7. **Fail soft on imagery.** A satellite API outage must never block a manager from submitting a report.
8. Keep scope exactly as written. Out-of-scope items are in Section 16.

---

## 1. Current project status (from the repo README)

> Only the README was readable during planning (deeper GitHub pages were blocked). Items marked `VERIFY` must be confirmed in Phase 0.

**Stack:** Next.js 14 App Router + TypeScript + Tailwind + Recharts + Lucide + Zustand. FastAPI service (`packages/ml_services/api/app.py`) with routers `/teme /ocr /recommendations /ingestion /policies /compliance`. Supabase Postgres with RLS on 23 tables. Groq `llama-3.3-70b-versatile` for recommendations with a catalog fallback. TEME engine (deterministic + ML survival model).

**Roles:** `admin` (`/admin/*`), `manager` (`/(dashboard)/*`), `viewer` (`/viewer/*`). One manager per client company is the normal case.

**What is strong:**
- Full pipeline: CSV/receipt ingestion, emissions engine, AI recommendations, TEME offset planning, compliance with OCR evidence upload.
- Real RBAC with database-level RLS and a cascade-delete function for organizations.
- A resilient Supabase client wrapper (`safe_execute`) and a `common` AuthZ module.

**The gap this feature closes:** the loop is open at the end. Recommendations can be set to `in_progress` ("Begin Implementation") and TEME produces a tree count, but nothing records whether trees were actually planted, where, or when. Compliance evidence upload verifies *compliance tasks*, not *plantation*.

**Hygiene items to be aware of (do not fix as part of this feature; list them in the PR description):**
- README lists migrations under both `supabase/migrations/` and `infrastructure/supabase/migrations/`. `VERIFY` which is canonical and put the new migration there.
- Root contains stray files (`_temp_clear_repo`, `desktop.ini`, `ids.txt`, two `baseline_survival_model_*.py`, a `CarbonSense_Dynamic_Platform_Plan (4).md`). Leave them alone.
- README says "23 tables with RLS". After this feature it is 27 (Section 8). Update README counts and add the new endpoints and env vars.
- `delete_organization_cascade` must be extended (Section 8.6). **This is easy to miss and would leave orphaned company files in storage.**

---

## 2. Feature summary

**Name:** *Plantation Verification* (admin sidebar label) / *Plantation Tracker* (manager label).

**One-sentence version:** managers log verified plantation progress against their TEME plan through a short form with photo proof; admins see every company's submissions in one organized, searchable place with satellite imagery of the exact coordinates.

**Principles**
- Light-touch: we provide evidence tooling for admins. We do **not** audit every company.
- Evidence = manager form + geotagged photos + satellite context + automatic sanity flags. Admin review is optional and lightweight.
- Strict tenant isolation enforced in the database, not only in the UI.

---

## 3. Key decisions (with reasons)

| Decision | Choice | Why |
|---|---|---|
| Reporting cadence | **Quarterly**, aligned to the Indian financial year (Q1 Apr–Jun, Q2 Jul–Sep, Q3 Oct–Dec, Q4 Jan–Mar). Report due within **15 days** after quarter end. Plus an optional **interim update** any time. | Saplings change slowly and satellite change signals need months. Monthly adds burden with no extra evidence. Interim updates cover big planting drives. FY start month is a constant (`PLANTATION_FY_START_MONTH=4`). |
| Site registry | New `plantation_sites` table. A site is created from a TEME run (lat/lng/area/target prefilled) or manually. | Avoids re-typing coordinates every quarter, gives admins a stable per-site timeline, and enables the coordinate lock below. |
| Coordinates integrity | Site lat/lng/area **cannot be edited once any report exists**. New location = new site. Each report also stores a **snapshot** of lat/lng/area. | Prevents moving the pin after the fact. |
| Photo proof | **Minimum 1, maximum 6** photos per report. Camera capture or upload. EXIF GPS/time read client-side and sent as metadata. | The user asked for camera/upload proof. A constant `PLANTATION_MIN_PHOTOS=1` makes it easy to relax. |
| Review model | Admin status: `pending` → `reviewed` or `needs_attention`, plus a short note. Manager sees status + note read-only. | Simple, no heavy workflow. |
| Satellite stack | Esri World Imagery tiles (high-res visual) + Copernicus Data Space Sentinel-2 (latest scene and NDVI trend). Details in Section 7. | Best free combination for visual inspection plus a measurable vegetation signal. |
| Where reads happen | Manager and admin **reads** go straight through Supabase + RLS. **Writes** (submit report, imagery fetch, review) go through FastAPI / RPC. | Least code, and RLS is the single enforcement point for isolation. |
| Timezone | Store `timestamptz` (UTC). Display in **IST (Asia/Kolkata)** with UTC in tooltip. | Platform is India-focused. |

---

## 4. User flows

### 4.1 Manager
1. Opens **Tree Engine (TEME)** → tab **Plantation Tracker** (or arrives from a Recommendation card / dashboard banner).
2. If no site exists for a TEME run: **"Register plantation site"**: prefilled lat/lng/area/target from the TEME run. Manager confirms (editable, with warning).
3. Clicks **"Submit plantation report"** → single-page form (Section 5) → review → submit.
4. Sees the report in their history with status (Received / Reviewed / Needs attention) and cumulative progress vs TEME target.

### 4.2 Admin
1. Sidebar → **Plantation Verification**.
2. Overview KPIs → **All Reports** table (search + filters) or **By Company** view.
3. Opens a report → sees submitted data, photos, flags, map with satellite imagery, NDVI trend → sets review status + optional note.

---

## 5. Manager form specification

Route and layout in Section 6. Mobile-first (the camera flow matters). One page, four sections, sticky submit bar.

### Section A: Site and period
| Field | Required | Type / rules |
|---|---|---|
| Plantation site | **Yes** | Select from the org's sites; prefilled if arriving from a TEME run |
| Latitude | **Yes** | Number, −90..90, up to 6 decimals. Prefilled from site, read-only unless creating a site |
| Longitude | **Yes** | Number, −180..180, up to 6 decimals. Same rule |
| Area of land (hectares) | **Yes** | Number > 0, ≤ 50,000, up to 4 decimals. Same rule |
| Reporting period | **Yes** | Auto-computed label e.g. `FY2026-27-Q3` plus start/end dates. Not editable. Checkbox **"This is an interim update"** |
| Boundary on map | No | Optional polygon drawn on a small Leaflet map. Stored as GeoJSON. Used to draw the outline for admins |

A small map preview with the pin appears in this section so the manager can sanity-check coordinates. Include a **"Use my current location"** button (browser geolocation) for managers standing on site.

### Section B: Planting details
| Field | Required | Type / rules |
|---|---|---|
| Planting start date, end date (for trees reported this period) | **Yes** | Dates, end ≥ start, end ≤ today |
| Trees planted this period | **Yes** | Integer ≥ 0 |
| Total trees planted so far (cumulative) | **Yes** | Integer ≥ this period. Prefill = previous cumulative + this period (editable) |
| Species planted | **Yes (≥1)** | Multi-select seeded from the species list used by TEME, plus "Other (type name)". Optional count per species |
| Survival estimate (%) | No | 0–100, from a sample count |
| Planting method | No | `nursery_saplings`, `direct_seeding`, `miyawaki_dense`, `other` |
| Implementing partner (NGO / contractor / in-house) | No | Text, ≤120 chars |
| Maintenance done | No | Checkboxes: watering, fencing, weeding, mulching, replacement of dead saplings |
| Challenges / notes | No | Textarea, ≤1000 chars |

A live **progress bar** shows `cumulative / TEME target` using the site's `target_trees`.

### Section C: Photo proof
- Two buttons: **Take photo** (`<input type="file" accept="image/*" capture="environment">`) and **Upload from gallery** (multiple).
- Min 1, max 6. Accept JPEG, PNG, WebP (and HEIC if the browser can convert; otherwise ask for JPEG). Reject others.
- **Client side, before upload:**
  1. Read EXIF (GPS lat/lng, `DateTimeOriginal`) with `exifr`. Send as metadata.
  2. If the photo came from the camera button and EXIF GPS is absent, call `navigator.geolocation` once and attach that as `captured_lat/lng` with `gps_source="device"`.
  3. Compress with `browser-image-compression` to max 1600 px long edge, target ≤ 1.5 MB. (Canvas re-encode strips EXIF, which is fine because the metadata was already extracted.)
- Show thumbnails with remove button and a per-photo GPS badge ("Location found" / "No location").
- Optional caption per photo (≤140 chars).

### Section D: Review and declare
- Summary of what will be submitted.
- **Required checkbox:** "I confirm the information and photos are accurate and were taken at the plantation site."
- Submit button. On success show a confirmation with the report ID and timestamp (IST).

### Behaviour
- Client + server validation (zod on client, pydantic on server, same rules).
- Draft text fields persisted in `localStorage` per site (photos are not persisted). Wrap storage access in try/catch.
- Soft warnings (never block): coordinates outside India's bounding box (lat 6.5–37.5, lng 68–97.5), edited coordinates differ from the TEME run by > 1 km, cumulative > target.

---

## 6. Manager portal placement

**Decision: the feature lives inside the Tree Engine (TEME) module, not as a new top-level sidebar item.** The form reports on a TEME plan, the coordinates and area come from TEME, so that is where a manager will look for it.

1. **Primary home:** TEME page gets a tab/section **"Plantation Tracker"**.
   - Suggested routes (adapt to actual route names, `VERIFY`): `/tree-engine/plantation` (sites + report history + progress), `/tree-engine/plantation/new` (the form, a full page rather than a drawer, because camera flows are poor in drawers on mobile), `/tree-engine/plantation/[reportId]` (read-only report view).
2. **Contextual entry points:**
   - On each saved TEME run card: button **"Log plantation progress"** (prefills the site).
   - On Recommendation cards that are tree/offset related and have status `in_progress`: **"Report plantation progress"** link.
3. **Reminder:** on the Executive Dashboard, a small banner card **"Plantation report due by {date}"** shown when an active site has no report for the current period. No email in this version.
4. **Viewers get no access** in this version (no UI, no RLS read policy).

---

## 7. Satellite imagery and verification stack

### 7.1 Honest limits (put a short version of this in the admin UI as an info tooltip)
- **No free source is truly "live".** Sentinel-2 revisits roughly every 3–5 days at 10 m resolution. High-resolution basemaps are periodic composites with varying capture dates. The UI must always show **the capture date** of whatever imagery is displayed ("Latest available imagery").
- **Newly planted saplings are not individually visible at 10 m**, and often not in basemaps for the first 1–3 years. Satellite data is **supporting evidence** (land is real, location is consistent, vegetation trend), **not a tree counter**. Do not label anything "verified by satellite".

### 7.2 Chosen components

| Role | Provider | Use | Cost / limits |
|---|---|---|---|
| **High-res visual layer (admin map)** | **Esri World Imagery** via ArcGIS Location Platform (API key) | Satellite basemap in Leaflet, zoom to the site | Free tier: 2M basemap tiles/month (then paid). Restrict the key by referrer and service scope. Show Esri attribution. |
| **Latest scene + NDVI trend** | **Copernicus Data Space Ecosystem, Sentinel Hub Process + Statistical APIs** (Sentinel-2 L2A) | Backend fetches a true-colour thumbnail of the most recent low-cloud scene and a 12-month NDVI series | Free general-user quota (about 10,000 processing units per month per CDSE; `VERIFY` the exact number in your CDSE dashboard). One 512×512, 3-band image ≈ 1 PU, so quota is ample if results are **cached**. |
| **Backup (no code change to schema)** | Microsoft Planetary Computer STAC + data API | Same Sentinel-2 data if CDSE is down or the quota is exhausted. STAC is public; assets need a short-lived signed token | Free |
| **Zero-cost extra** | Deep links | "Open in Google Maps satellite" and "Open in Copernicus Browser" buttons on the report page | No API key |
| **Phase 2 (not now)** | Meta/WRI Global Tree Canopy Height (1 m, free, updated 2026) | Pre-planting canopy baseline and change over time on larger sites | Free data on AWS / Earth Engine, model on GitHub. Reflects canopy height, so it will not show young saplings. |

Not chosen as primary: Google Earth Engine (adds account/eligibility terms and a heavier client, `VERIFY` before reconsidering), paid commercial imagery (Planet, Maxar), Mapbox (kept as a possible swap for Esri if the free tier is outgrown).

### 7.3 Deep link formats
- Google Maps satellite: `https://www.google.com/maps/@?api=1&map_action=map&center={lat},{lng}&zoom=18&basemap=satellite`
- Copernicus Browser: link to `https://browser.dataspace.copernicus.eu/` with lat/lng zoom parameters (`VERIFY` the current URL parameter format).

### 7.4 Backend imagery job (FastAPI, background task after report insert)
1. **Area of interest:** square bbox centred on the site, half-side = `max(400 m, sqrt(area_ha × 10000) / 2 + 250 m)`. Convert metres to degrees with the usual latitude/cosine-latitude approximation. If `boundary_geojson` exists, use it for NDVI statistics instead of the bbox.
2. **Authentication:** CDSE OAuth2 client-credentials (client id/secret in env, backend only). Cache the token until shortly before expiry.
3. **Latest scene:** Process API request, Sentinel-2 L2A, true colour (B04, B03, B02), 512×512, `maxCloudCoverage` 30, `mosaickingOrder: leastCC`, time range = last 30 days up to the submission date. If nothing is found, widen to 90 days, then give up with status `skipped` and reason `no_clear_scene`.
4. **NDVI series:** Statistical API, evalscript using B04/B08 with the SCL band to mask clouds/shadows, aggregation 30 days over the previous 12 months. Store `[{from, to, mean, sample_count}]`.
5. **Store results** in `plantation_imagery_snapshots` (Section 8.2) and the PNG in the private `plantation-imagery` bucket under `{org_id}/{site_id}/{report_id}.png`.
6. **Caching and quota:** never re-fetch for a report that already has `ready` imagery. Admin "Refresh imagery" button limited to once per report per 24 h. If a request returns a quota or rate error, mark `failed` with the message and stop (no retry loops).
7. **Small-site warning:** if `area_ha < 1`, show "Site is too small for reliable 10 m satellite statistics. Rely on the high-resolution map and photos." and skip NDVI.
8. **Never block the submit response.** The job runs after the report is committed.

### 7.5 Automatic sanity flags (computed server-side at submit; shown to admin)
| Code | Severity | Rule (thresholds are constants in one config module) |
|---|---|---|
| `PHOTO_NO_GPS` | warn | A photo has no usable location |
| `PHOTO_FAR_FROM_SITE` | warn | Photo location > 1,000 m from site point (or outside boundary if given) |
| `PHOTO_OUT_OF_PERIOD` | info | Photo timestamp earlier than period start − 7 days or later than submit time |
| `DENSITY_HIGH` | warn | `trees_planted_cumulative / area_ha` above 3,000 per hectare (configurable; dense methods like Miyawaki can legitimately exceed this) |
| `EXCEEDS_TARGET` | info | Cumulative > 120% of TEME target |
| `COORDS_OUTSIDE_INDIA` | info | Outside the India bounding box |
| `OVERLAPS_OTHER_ORG` | **alert, admin-only** | Another company's site lies within 100 m, or boundaries intersect. Catches the same land counted twice |
| `NO_PHOTOS_REUSED` | warn | Byte-identical photo hash already used in another report (store a SHA-256 per photo) |

Flags are **advisory**. They never reject a submission.

---

## 8. Database design

Add one migration named in the repo's style (the existing ones look like `20260809_*.sql`): `20261002_plantation_verification.sql` in the canonical migrations folder (`VERIFY`, Section 1).

### 8.1 Helper functions (reuse existing ones if present)
The repo already has RLS helpers for the 3-role model (see `002_role_redesign_rls.sql`, `VERIFY` names). The SQL below uses `public.auth_org_id()` and `public.auth_role()` as **placeholders**. If equivalents exist, use them. If not, create them as `SECURITY DEFINER`, `STABLE`, `SET search_path = public`, reading the caller's row in the profiles table.

### 8.2 Tables

```sql
create extension if not exists pg_trgm;

create table public.plantation_sites (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid not null references public.organizations(id) on delete cascade,
  teme_run_id      uuid null,            -- FK to existing TEME runs table (VERIFY name); keep nullable, on delete set null
  recommendation_id uuid null,           -- optional link to the recommendation (VERIFY name)
  name             text not null check (char_length(name) between 2 and 120),
  latitude         double precision not null check (latitude  between -90  and 90),
  longitude        double precision not null check (longitude between -180 and 180),
  area_hectares    numeric(12,4) not null check (area_hectares > 0 and area_hectares <= 50000),
  boundary_geojson jsonb null,
  target_trees     integer null check (target_trees >= 0),   -- copied from TEME at creation
  region_label     text null,
  status           text not null default 'active' check (status in ('active','completed','archived')),
  created_by       uuid not null references auth.users(id),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index on public.plantation_sites (org_id);
create index on public.plantation_sites using gin (name gin_trgm_ops);

create table public.plantation_reports (
  id                        uuid primary key default gen_random_uuid(),
  org_id                    uuid not null references public.organizations(id) on delete cascade,
  site_id                   uuid not null references public.plantation_sites(id) on delete cascade,
  submitted_by              uuid not null references auth.users(id),
  submitted_at              timestamptz not null default now(),
  period_label              text not null,                 -- 'FY2026-27-Q3'
  period_start              date not null,
  period_end                date not null,
  is_interim                boolean not null default false,
  -- immutable snapshot of site at submit time
  latitude                  double precision not null,
  longitude                 double precision not null,
  area_hectares             numeric(12,4) not null,
  planting_start_date       date not null,
  planting_end_date         date not null check (planting_end_date >= planting_start_date),
  trees_planted_this_period integer not null check (trees_planted_this_period >= 0),
  trees_planted_cumulative  integer not null check (trees_planted_cumulative >= trees_planted_this_period),
  species                   jsonb not null,                -- [{ "name": "Neem", "count": 120|null }]
  survival_rate_pct         numeric(5,2) null check (survival_rate_pct between 0 and 100),
  planting_method           text null check (planting_method in ('nursery_saplings','direct_seeding','miyawaki_dense','other')),
  implementing_partner      text null check (char_length(implementing_partner) <= 120),
  maintenance_activities    text[] null,
  notes                     text null check (char_length(notes) <= 1000),
  declaration_accepted      boolean not null check (declaration_accepted),
  review_status             text not null default 'pending' check (review_status in ('pending','reviewed','needs_attention')),
  reviewed_by               uuid null references auth.users(id),
  reviewed_at               timestamptz null,
  admin_note                text null check (char_length(admin_note) <= 1000),
  imagery_status            text not null default 'pending' check (imagery_status in ('pending','ready','failed','skipped'))
);
create index on public.plantation_reports (org_id, submitted_at desc);
create index on public.plantation_reports (submitted_at desc);
create index on public.plantation_reports (site_id, submitted_at desc);
create index on public.plantation_reports (review_status);

create table public.plantation_report_photos (
  id            uuid primary key default gen_random_uuid(),
  report_id     uuid not null references public.plantation_reports(id) on delete cascade,
  org_id        uuid not null references public.organizations(id) on delete cascade,  -- denormalized for RLS
  storage_path  text not null,            -- '{org_id}/{site_id}/{report_id}/{uuid}.jpg'
  sha256        text not null,
  caption       text null check (char_length(caption) <= 140),
  gps_lat       double precision null,
  gps_lng       double precision null,
  gps_source    text null check (gps_source in ('exif','device','none')),
  taken_at      timestamptz null,
  distance_from_site_m integer null,      -- computed server-side
  created_at    timestamptz not null default now()
);
create index on public.plantation_report_photos (report_id);
create index on public.plantation_report_photos (sha256);

create table public.plantation_report_flags (
  id                  uuid primary key default gen_random_uuid(),
  report_id           uuid not null references public.plantation_reports(id) on delete cascade,
  org_id              uuid not null references public.organizations(id) on delete cascade,
  code                text not null,
  severity            text not null check (severity in ('info','warn','alert')),
  detail              jsonb not null default '{}',
  visible_to_manager  boolean not null default true,   -- false for OVERLAPS_OTHER_ORG
  created_at          timestamptz not null default now()
);
create index on public.plantation_report_flags (report_id);

create table public.plantation_imagery_snapshots (
  id            uuid primary key default gen_random_uuid(),
  report_id     uuid not null references public.plantation_reports(id) on delete cascade,
  site_id       uuid not null references public.plantation_sites(id) on delete cascade,
  org_id        uuid not null references public.organizations(id) on delete cascade,
  provider      text not null default 'cdse_sentinel2',
  scene_date    date null,
  cloud_pct     numeric(5,2) null,
  image_path    text null,
  ndvi_series   jsonb null,               -- [{from,to,mean,sample_count}]
  status        text not null check (status in ('ready','failed','skipped')),
  error_message text null,
  fetched_at    timestamptz not null default now()
);
create index on public.plantation_imagery_snapshots (report_id, fetched_at desc);
```

### 8.3 RLS (enable on all five tables)

```sql
alter table public.plantation_sites            enable row level security;
alter table public.plantation_reports          enable row level security;
alter table public.plantation_report_photos    enable row level security;
alter table public.plantation_report_flags     enable row level security;
alter table public.plantation_imagery_snapshots enable row level security;

-- SITES: manager full access to OWN org; admin read-only to all
create policy sites_mgr_select on public.plantation_sites for select
  using (public.auth_role() = 'manager' and org_id = public.auth_org_id());
create policy sites_mgr_insert on public.plantation_sites for insert
  with check (public.auth_role() = 'manager' and org_id = public.auth_org_id() and created_by = auth.uid());
create policy sites_mgr_update on public.plantation_sites for update
  using (public.auth_role() = 'manager' and org_id = public.auth_org_id())
  with check (org_id = public.auth_org_id());
create policy sites_admin_select on public.plantation_sites for select
  using (public.auth_role() = 'admin');

-- REPORTS: manager select/insert own org; admin select all; NO update/delete policies
create policy reports_mgr_select on public.plantation_reports for select
  using (public.auth_role() = 'manager' and org_id = public.auth_org_id());
create policy reports_mgr_insert on public.plantation_reports for insert
  with check (public.auth_role() = 'manager' and org_id = public.auth_org_id() and submitted_by = auth.uid());
create policy reports_admin_select on public.plantation_reports for select
  using (public.auth_role() = 'admin');

-- PHOTOS and SNAPSHOTS: select only (writes are service-role from FastAPI)
create policy photos_mgr_select on public.plantation_report_photos for select
  using (public.auth_role() = 'manager' and org_id = public.auth_org_id());
create policy photos_admin_select on public.plantation_report_photos for select
  using (public.auth_role() = 'admin');
create policy snaps_mgr_select on public.plantation_imagery_snapshots for select
  using (public.auth_role() = 'manager' and org_id = public.auth_org_id());
create policy snaps_admin_select on public.plantation_imagery_snapshots for select
  using (public.auth_role() = 'admin');

-- FLAGS: manager sees only visible_to_manager rows
create policy flags_mgr_select on public.plantation_report_flags for select
  using (public.auth_role() = 'manager' and org_id = public.auth_org_id() and visible_to_manager);
create policy flags_admin_select on public.plantation_report_flags for select
  using (public.auth_role() = 'admin');
```

Rules:
- The FastAPI backend uses the service role (bypasses RLS) for inserts of photos, flags, and snapshots. It must **still** verify the caller's role and derive `org_id` from their profile before writing.
- Managers can insert reports via FastAPI only. Do **not** expose direct client-side inserts for photos.

### 8.4 Coordinate lock trigger and admin review RPC

```sql
create or replace function public.plantation_sites_guard() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  if (new.latitude, new.longitude, new.area_hectares) is distinct from
     (old.latitude, old.longitude, old.area_hectares)
     and exists (select 1 from public.plantation_reports r where r.site_id = old.id) then
    raise exception 'Site location and area are locked once a report exists. Create a new site instead.';
  end if;
  if new.org_id <> old.org_id then raise exception 'org_id is immutable'; end if;
  return new;
end $$;
create trigger trg_plantation_sites_guard before update on public.plantation_sites
  for each row execute function public.plantation_sites_guard();

create or replace function public.review_plantation_report(
  p_report_id uuid, p_status text, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if public.auth_role() <> 'admin' then raise exception 'forbidden'; end if;
  if p_status not in ('pending','reviewed','needs_attention') then raise exception 'invalid status'; end if;
  update public.plantation_reports
     set review_status = p_status, admin_note = left(p_note, 1000),
         reviewed_by = auth.uid(), reviewed_at = now()
   where id = p_report_id;
end $$;
revoke all on function public.review_plantation_report(uuid, text, text) from public, anon;
grant execute on function public.review_plantation_report(uuid, text, text) to authenticated;
```

### 8.5 Admin read view (search + company names in one query)

```sql
create view public.plantation_reports_admin_v with (security_invoker = true) as
select r.*, o.name as org_name, s.name as site_name, s.target_trees,
       (select count(*) from public.plantation_report_photos p where p.report_id = r.id) as photo_count,
       (select count(*) from public.plantation_report_flags f where f.report_id = r.id and f.severity in ('warn','alert')) as flag_count
from public.plantation_reports r
join public.organizations o on o.id = r.org_id      -- VERIFY organizations name column
join public.plantation_sites s on s.id = r.site_id;
```
`security_invoker = true` makes RLS apply, so a manager querying it still only sees their own rows. Add a trigram index on `organizations.name` if needed for search.

### 8.6 Storage and cascade delete
- Create **private** buckets `plantation-proofs` and `plantation-imagery`. Object path always starts with `{org_id}/`.
- Storage policies (`storage.objects`): `select` allowed when `bucket_id` is one of the two buckets **and** `(storage.foldername(name))[1] = public.auth_org_id()::text` **and** role is `manager`; separate `select` for `admin` on both buckets. **No client insert/update/delete policies** (uploads come from FastAPI with the service role).
- Admin image access: the browser creates **signed URLs with a 10-minute expiry** (admin RLS permits it), never public URLs.
- **Extend company deletion:** FK `on delete cascade` removes the rows, but not the stored files. In the existing admin route that calls `delete_organization_cascade` (`DELETE /api/admin/companies`), **first** remove all objects under `{org_id}/` in both buckets using the Storage API (list + remove, paginate), **then** call the cascade function. Do not delete from `storage.objects` with raw SQL.
- Update the cascade function only if it enumerates tables explicitly (`VERIFY`); the new tables are covered by FK cascades.

---

## 9. Backend API

New FastAPI router file following the existing router pattern: `packages/ml_services/api/plantation.py`, mounted at `/plantation` in `app.py`. Reuse the `common` AuthZ dependency; add an admin-role check helper if one does not exist.

| Method + path | Role | Purpose |
|---|---|---|
| `POST /plantation/sites` | manager | Create site (from TEME run or manual). Server copies `target_trees` from the TEME run if `teme_run_id` is given and belongs to the caller's org |
| `POST /plantation/reports` | manager | `multipart/form-data`: `payload` (JSON string) + `photos[]` + `photo_meta` (JSON array aligned to photos). Validates, uploads photos, inserts report + photos, computes flags, then schedules the imagery job |
| `POST /plantation/reports/{id}/refresh-imagery` | admin | Re-run imagery job (24 h limit per report) |
| `GET /plantation/config` | any authed | Returns constants the UI needs (min/max photos, FY start month, thresholds) so client and server never drift |

**Reads** (site lists, report history, admin lists, detail, signed URLs) use the Supabase client with the user's session so **RLS is the only gatekeeper**. **Review** uses `supabase.rpc('review_plantation_report', ...)` directly from the admin UI.

### `POST /plantation/reports` server steps (in order)
1. Authenticate; require `manager`; load caller's `org_id` from profile (ignore any client value).
2. Load site; reject if `site.org_id` ≠ caller's org (return 404, not 403, to avoid leaking existence).
3. Validate payload (pydantic): ranges from Section 5; period computed **server-side** from the current date and `is_interim`; lat/lng/area must equal the site's values (snapshot them).
4. Validate each photo: count within limits, MIME whitelist **and** magic-byte check, ≤ 3 MB each, total request ≤ 20 MB; compute SHA-256.
5. Rate limit: max 10 report submissions per org per day.
6. Upload photos to `plantation-proofs/{org_id}/{site_id}/{report_id}/{uuid}.jpg`. If any later step fails, delete uploaded files (compensating cleanup).
7. Insert report, photos (with `distance_from_site_m` via haversine), flags (Section 7.5), including the admin-only overlap check using the service role.
8. Return `{report_id, submitted_at, flags_visible_to_manager}`; start the imagery background task.

---

## 10. Admin portal specification

### 10.1 Navigation
- Add a sidebar button **"Plantation Verification"** (Lucide `TreePine`) in the admin sidebar, placed after Company Management / Manager Oversight and before Platform Health. Route group `/admin/plantation/*`. Use the existing sidebar item component and active-state styling.

### 10.2 Pages

**`/admin/plantation` (landing)**
- KPI row (use existing stat-card component): *Reports this quarter*, *Companies reported / total companies*, *Pending review*, *Needs attention*, *Flagged reports*.
- Two tabs: **All Reports** (default) and **By Company**.

**All Reports tab**
- Table columns: Submitted at (IST) · Company · Site · Period · Trees this period · Cumulative · Photos · Flags · Review status · View.
- **Search box:** matches company name, site name, or report ID (ILIKE / trigram on `org_name`, `site_name`, `id::text`).
- **Filters:** company (select), submitted date range with presets (Today, Last 7 days, Last 30 days, This quarter, Custom range), period label, review status, "Has flags" toggle, interim only.
- **Sort:** submitted_at desc by default; sortable columns.
- Server-side pagination (20 per page), filter state kept in the URL query string so views are shareable and restorable.
- Empty and loading states in the platform's existing style.

**By Company tab**
- Grid/list of companies with: name, number of sites, last report date, cumulative trees, pending count. Search by company name. Companies with **no reports** are shown too (with "No reports yet") so admins can see who is not reporting.
- Click → **`/admin/plantation/companies/[orgId]`**:
  - Header with company name and totals.
  - Sites list; selecting a site shows a Recharts line/bar chart of cumulative trees per report against the TEME target.
  - That company's reports table (same component, pre-filtered, same date filters). Everything scoped to one company.

**Report detail: `/admin/plantation/reports/[reportId]`**
- Left column: summary cards (company, site, coordinates, area, period, submitted at, submitted by), planting details, species, maintenance, notes, **flags list** (with severity badges and plain-English explanations), **photo gallery** with lightbox showing caption, GPS badge, taken-at and distance from site.
- Right column: **map** (Leaflet, Esri World Imagery, marker + boundary polygon + 250 m circle reference), layer toggle **High-res map / Sentinel-2 latest scene** (the cached PNG draped on the bbox as an image overlay with its `scene_date` shown), **NDVI trend chart**, **Refresh imagery** button, and the two deep-link buttons (Google Maps satellite, Copernicus Browser). Info tooltip with the limits from Section 7.1.
- Review panel: status select (`pending`, `reviewed`, `needs_attention`), note textarea, Save (calls the RPC). Show who reviewed and when.
- Previous / next report arrows within the current filtered list.

### 10.3 Admin-only isolation
Admin pages call only admin-permitted reads. A manager hitting `/admin/*` is already blocked by the existing route guard; the database policies are the second layer.

---

## 11. UI theme rules (must match the platform exactly)

Phase 0 must produce a short "theme notes" list before building UI. Then:
1. Extract tokens from `tailwind.config.ts`, global CSS, and **two reference pages**: an existing admin page (e.g. `/admin/companies`) and an existing manager page (e.g. Compliance or TEME).
2. Reuse existing components for: sidebar item, page header, cards, stat cards, tables, badges/status pills, buttons, inputs/selects, modals, tabs, empty/loading/error states, toasts.
3. Status colors: map `pending / reviewed / needs_attention` and flag severities `info / warn / alert` to the **existing** semantic colors used elsewhere (e.g. compliance status pills). No new hex values.
4. Leaflet: import its CSS only in the map component (dynamic import, `ssr: false`). Match map container radius/border to platform cards. Do not let Leaflet's default styles override the theme (scope overrides to the map wrapper).
5. Charts: Recharts, with the same color palette and tooltip style as the existing Analytics/Compliance charts.
6. Responsive: manager form must work well at 360 px width; admin tables scroll horizontally inside their card on small screens.
7. Dark/light behavior: follow whatever the platform already does.
8. Accessibility: labels on all inputs, keyboard-operable lightbox, alt text on photos (caption or "Plantation photo N").

---

## 12. Security and validation checklist

- [ ] `org_id` derived server-side everywhere; client value ignored.
- [ ] RLS enabled on all five tables; **cross-tenant test passes** (Section 15).
- [ ] No UPDATE/DELETE policy on `plantation_reports`; only the `review_plantation_report` RPC can change review fields.
- [ ] Buckets private; signed URLs ≤ 10 min; object path prefix equals `org_id`.
- [ ] Photo validation: MIME + magic bytes + size caps; filename never used as storage path (use UUID).
- [ ] Coordinates, area, counts validated with the same bounds on client and server.
- [ ] `OVERLAPS_OTHER_ORG` flag and any other company's identity are never returned to a manager (`visible_to_manager = false`).
- [ ] Secrets (`CDSE_CLIENT_SECRET`) backend-only. The Esri key is browser-visible by design: restrict it by referrer and scope it to basemap tiles only.
- [ ] Rate limits: report submissions per org per day; imagery refresh per report per day.
- [ ] Error messages do not leak other tenants' data or internal stack traces.

---

## 13. Configuration and dependencies

**Backend `.env` (add to `.env.example`)**
```
CDSE_CLIENT_ID=
CDSE_CLIENT_SECRET=
CDSE_TOKEN_URL=https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token
CDSE_SH_BASE_URL=https://sh.dataspace.copernicus.eu
PLANTATION_FY_START_MONTH=4
PLANTATION_MIN_PHOTOS=1
PLANTATION_MAX_PHOTOS=6
PLANTATION_DENSITY_WARN_PER_HA=3000
PLANTATION_PHOTO_MAX_DISTANCE_M=1000
PLANTATION_OVERLAP_RADIUS_M=100
```
**Frontend `.env.local`**
```
NEXT_PUBLIC_ARCGIS_API_KEY=        # referrer-restricted, basemap tiles scope only
```
**New frontend dependencies (add only if not already present):** `leaflet`, `react-leaflet`, `@types/leaflet`, `exifr`, `browser-image-compression`, plus `zod` and `react-hook-form` if the repo does not already use a form/validation stack (`VERIFY`; prefer whatever the existing forms use).
**New backend dependencies:** `httpx` or `requests` (use what the repo already uses), `python-multipart` (for FastAPI uploads), `Pillow` (magic-byte/format check). Add to `requirements.txt`.

**Esri tile URL:** use the ArcGIS Static Basemap Tiles service for imagery with the API key as a token. `VERIFY` the exact URL pattern in Esri's current docs, and add the required attribution text to the Leaflet `TileLayer`. If the key is missing, fall back to OpenStreetMap tiles with a visible notice "Satellite layer unavailable".

---

## 14. Implementation phases

### Phase 0: Discovery (read-only, produce notes, no code)
- [ ] Locate the canonical migrations folder; read `001_auth_schema.sql`, `002_role_redesign_rls.sql`, the cascade-delete migration. Record real names of: organizations table, profiles table, RLS helper functions, TEME runs table, recommendations table.
- [ ] Read the compliance evidence upload (frontend + `/compliance/evidence`) and reuse its upload and authz patterns.
- [ ] Find the TEME page/route, species list source, the TEME form's lat/lng/area fields, and how saved TEME runs are listed.
- [ ] Find admin sidebar component, admin layout, route guard; manager sidebar/layout.
- [ ] Write the theme notes (Section 11).
- [ ] Confirm which dependencies already exist.
- [ ] Output: a short `docs/plantation_phase0_notes.md` listing every `VERIFY` item resolved.

### Phase 1: Database
- [ ] Migration: tables, indexes, RLS, guard trigger, review RPC, admin view, buckets, storage policies.
- [ ] Extend company-delete route to purge storage prefixes (Section 8.6).
- [ ] SQL test script (in `scripts/`) proving isolation (Section 15).

### Phase 2: Backend
- [ ] `plantation.py` router: config, sites, reports (multipart), flags, compensating cleanup.
- [ ] Config module holding every threshold constant.
- [ ] Unit tests (Section 15).

### Phase 3: Manager UI
- [ ] Plantation Tracker tab in TEME, site registration, report form (4 sections), history list, read-only report view.
- [ ] Entry points: TEME run card button, Recommendation card link, dashboard due banner.
- [ ] Client-side EXIF + compression + geolocation handling.

### Phase 4: Admin UI
- [ ] Sidebar button, landing KPIs, All Reports table (search + filters + URL state), By Company tab, company page, report detail with gallery, flags, review panel.
- [ ] Map component with Esri layer and deep links (imagery overlays added in Phase 5).

### Phase 5: Imagery job
- [ ] CDSE auth, Process API thumbnail, Statistical API NDVI, caching, status handling, refresh button, small-site rule.
- [ ] Sentinel-2 overlay toggle and NDVI chart in report detail.
- [ ] Optional: Planetary Computer fallback behind a feature flag.

### Phase 6: Hardening and docs
- [ ] Run Section 15 tests, `npx tsc --noEmit`, `npm run build`, `python -m pytest -q`.
- [ ] Update README (endpoints, env vars, table count 23 → 27, new module in Implemented Capabilities) and add a short `docs/plantation_verification.md`.
- [ ] PR description lists the hygiene items from Section 1 as observations only.

---

## 15. Testing and acceptance criteria

**Isolation tests (SQL or API, using two orgs A and B plus an admin):**
1. Manager A cannot select B's sites, reports, photos, flags, snapshots (0 rows).
2. Manager A cannot insert a report with `org_id = B` (rejected).
3. Manager A cannot update or delete any report (rejected).
4. Manager A cannot read B's storage objects, and cannot list B's prefix.
5. Admin can read everything and cannot update report data except via the RPC.
6. Manager calling the RPC is rejected.
7. Querying `plantation_reports_admin_v` as manager A returns only A's rows.
8. Viewer role gets no rows from any plantation table.
9. Editing a site's coordinates after a report exists fails; before any report exists it succeeds.

**Backend unit tests:** coordinate/area bounds, FY quarter computation (including 2026-10-02 → `FY2026-27-Q3`, period 2026-10-01 to 2026-12-31, and the Jan–Mar rollover), haversine distance, each flag rule, MIME/magic-byte rejection, photo count limits, duplicate-hash flag, overlap flag hidden from manager, compensating cleanup on failure.

**Manual acceptance:**
- [ ] Manager can submit a report from a phone using the camera; GPS badge appears; submit succeeds in under 10 s on a normal connection.
- [ ] Submission succeeds even when CDSE credentials are missing (imagery shows "unavailable").
- [ ] Admin sees the new report at the top of All Reports with an IST timestamp, can filter by date range and company, search by company name, and open a detail page with working map and photos.
- [ ] By Company shows companies with zero reports.
- [ ] Deleting a company removes its rows **and** its storage objects.
- [ ] UI visually matches existing pages (no new colors/fonts; side-by-side check with Compliance and Admin Companies pages).
- [ ] `npx tsc --noEmit`, `npm run build`, and `python -m pytest -q` all pass.

---

## 16. Out of scope (do not build now)

Email/SMS reminders; viewer access; admin editing of company data; automated tree counting; canopy-height change detection (Phase 2 idea using the Meta/WRI dataset); carbon credit issuance or certification; third-party auditor workflow; bulk export (CSV/PDF) of reports; all-sites overview map; drone imagery.

---

## 17. Open items the agent must resolve and report in Phase 0

1. Canonical migrations folder.
2. Real table and helper names for organizations, profiles, TEME runs, recommendations, and the RLS role/org helpers.
3. Actual TEME and admin route names for placing pages.
4. Current Esri static basemap tile URL pattern and CDSE quota numbers.
5. Whether `zod`, `react-hook-form`, `httpx`, `requests`, `Pillow` are already in use.
6. Whether `delete_organization_cascade` enumerates tables explicitly.
