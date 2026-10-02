# Plantation Verification — Storage Bucket Setup

## Required Supabase Storage Buckets

Create both buckets in Supabase Dashboard → Storage before deploying.

### 1. `plantation-proofs` (manager photo uploads)

| Setting | Value |
|---|---|
| Bucket name | `plantation-proofs` |
| Public | **No** (private) |
| File size limit | 3 MB (3145728 bytes) |
| Allowed MIME types | `image/jpeg, image/png, image/webp` |

**RLS Policies** (run in SQL editor):
```sql
-- Managers can INSERT their org's files
create policy "plantation_proofs_mgr_insert"
on storage.objects for insert
with check (
  bucket_id = 'plantation-proofs'
  and auth.role() = 'authenticated'
  and (storage.foldername(name))[1] = public.user_org_id()::text
);

-- Managers and admins can SELECT their org's files (signed URLs)
create policy "plantation_proofs_mgr_select"
on storage.objects for select
using (
  bucket_id = 'plantation-proofs'
  and (
    (public.get_user_role(auth.uid()) = 'manager' and (storage.foldername(name))[1] = public.user_org_id()::text)
    or public.is_platform_admin()
  )
);

-- Service role (used by FastAPI) can do anything (bypasses RLS by default)
```

---

### 2. `plantation-imagery` (Sentinel-2 satellite PNGs)

| Setting | Value |
|---|---|
| Bucket name | `plantation-imagery` |
| Public | **No** (private) |
| File size limit | 10 MB |
| Allowed MIME types | `image/png` |

**RLS Policies**:
```sql
-- Managers can SELECT their org's satellite images
create policy "plantation_imagery_mgr_select"
on storage.objects for select
using (
  bucket_id = 'plantation-imagery'
  and (
    (public.get_user_role(auth.uid()) = 'manager' and (storage.foldername(name))[1] = public.user_org_id()::text)
    or public.is_platform_admin()
  )
);

-- Only service role can INSERT (FastAPI background job writes here)
-- No INSERT policy needed for authenticated users
```

---

## Environment Variables Checklist

### Backend (`.env`)
```
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
CDSE_CLIENT_ID=<your CDSE OAuth2 client ID>
CDSE_CLIENT_SECRET=<your CDSE OAuth2 client secret>
```

### Frontend (`.env.local`)
```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
NEXT_PUBLIC_API_URL=http://localhost:8000  # or your deployed FastAPI URL
NEXT_PUBLIC_ARCGIS_API_KEY=              # optional — falls back to OSM tiles
```

---

## CDSE (Satellite Imagery) Setup

1. Create account at https://dataspace.copernicus.eu/
2. Go to **Settings → OAuth Clients → New Client**
3. Grant scope: `openid`, `profile`, `email`
4. Copy `Client ID` and `Client Secret` to backend `.env`
5. Free tier: ~1,000 processing units/month. Each imagery fetch uses ≈ 1–5 PUs.
6. If `CDSE_CLIENT_ID` is empty, imagery jobs auto-skip (status = `skipped`). This is safe.

---

## Live Satellite Map (Mapbox)

The plantation map shows **real satellite imagery** of exactly the lat/lng coordinates the manager enters. This is powered by Mapbox.

1. Go to https://account.mapbox.com/access-tokens/
2. Copy your **Default public token** (starts with `pk.eyJ1...`)
3. Set in frontend `.env.local`:
   ```
   NEXT_PUBLIC_MAPBOX_TOKEN=pk.eyJ1...
   ```

**Free tier:** 50,000 map loads/month — more than sufficient for a multi-company platform.  
**Without the token:** Map falls back to OpenStreetMap (street map only, no satellite view).

> **Security tip:** To prevent key abuse, go to Mapbox → Tokens → edit your token → add **Allowed URLs** (e.g. `https://your-app.vercel.app`) so the token only works on your domain.

---

## Database Migration

Run in Supabase SQL Editor:
```
supabase/migrations/20261002_plantation_verification.sql
```

Or via Supabase CLI:
```bash
supabase db push
```
