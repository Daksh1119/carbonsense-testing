-- CarbonSense RBAC auth foundation
-- Creates user_profiles, employee_signup_requests, manager_consents
-- and baseline row-level security policies.

create extension if not exists pgcrypto;

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  domain text,
  created_at timestamptz not null default now()
);

create table if not exists public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  role text not null check (role in ('admin', 'manager', 'viewer')),
  organization_id uuid references public.organizations(id),
  organization_name text,
  first_name text,
  last_name text,
  job_title text,
  department text,
  employee_id text,
  phone text,
  avatar_url text,
  approved boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.employee_signup_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  organization_name text,
  manager_email text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  form_data jsonb,
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewer_notes text
);

create table if not exists public.manager_consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  consent_version text not null default 'v1.0',
  digital_signature text,
  agreed_at timestamptz not null default now(),
  ip_address text,
  unique (user_id, consent_version)
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_user_profiles_updated_at on public.user_profiles;
create trigger trg_user_profiles_updated_at
before update on public.user_profiles
for each row execute function public.set_updated_at();

alter table public.user_profiles enable row level security;
alter table public.employee_signup_requests enable row level security;
alter table public.manager_consents enable row level security;

drop policy if exists "Users can view own profile" on public.user_profiles;
create policy "Users can view own profile"
on public.user_profiles
for select
using (auth.uid() = id);

drop policy if exists "Users can update own profile" on public.user_profiles;
create policy "Users can update own profile"
on public.user_profiles
for update
using (auth.uid() = id);

drop policy if exists "Admins full access" on public.user_profiles;
create policy "Admins full access"
on public.user_profiles
for all
using (
  exists (
    select 1
    from public.user_profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.user_profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
);

drop policy if exists "Users can view own signup request" on public.employee_signup_requests;
create policy "Users can view own signup request"
on public.employee_signup_requests
for select
using (user_id = auth.uid());

drop policy if exists "Managers can view routed requests" on public.employee_signup_requests;
create policy "Managers can view routed requests"
on public.employee_signup_requests
for select
using (lower(manager_email) = lower(auth.jwt() ->> 'email'));

drop policy if exists "Admins full access signup requests" on public.employee_signup_requests;
create policy "Admins full access signup requests"
on public.employee_signup_requests
for all
using (
  exists (
    select 1
    from public.user_profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.user_profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
);

drop policy if exists "Managers can view own consent" on public.manager_consents;
create policy "Managers can view own consent"
on public.manager_consents
for select
using (user_id = auth.uid());

drop policy if exists "Managers can insert own consent" on public.manager_consents;
create policy "Managers can insert own consent"
on public.manager_consents
for insert
with check (user_id = auth.uid());

drop policy if exists "Admins full access manager consents" on public.manager_consents;
create policy "Admins full access manager consents"
on public.manager_consents
for all
using (
  exists (
    select 1
    from public.user_profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.user_profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
);
