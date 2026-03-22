-- Recommendation workflow tables for Supabase.
-- Hardened for multi-tenant org access and auth.uid()-based RLS.

create extension if not exists pgcrypto;

-- Migration-local function name avoids collisions with other migrations.
create or replace function public.set_recommendation_updated_at()
returns trigger
language plpgsql
as $$
begin
	new.updated_at = now();
	return new;
end;
$$;

create table if not exists public.recommendation_sessions (
	id uuid primary key default gen_random_uuid(),
	organization_id uuid not null references public.organizations(id) on delete cascade,
	user_id uuid not null references auth.users(id) on delete restrict,
	project_name text not null,
	location text,
	emission_kg numeric,
	teme_run_id uuid,
	input_payload jsonb not null default '{}'::jsonb,
	context_snapshot jsonb not null default '{}'::jsonb,
	llm_provider text not null,
	llm_model text not null,
	prompt_version text not null default 'v1',
	status text not null default 'generated' check (status in ('pending', 'generated', 'approved', 'rejected', 'applied', 'error')),
	error_message text,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now()
);

-- Add TEME FK only when source table exists.
do $$
begin
	if to_regclass('public.teme_runs') is not null and not exists (
		select 1
		from information_schema.table_constraints
		where constraint_schema = 'public'
			and table_name = 'recommendation_sessions'
			and constraint_name = 'recommendation_sessions_teme_run_id_fkey'
	) then
		alter table public.recommendation_sessions
			add constraint recommendation_sessions_teme_run_id_fkey
			foreign key (teme_run_id) references public.teme_runs(id) on delete set null;
	end if;
end $$;

create index if not exists idx_recommendation_sessions_org_created
	on public.recommendation_sessions(organization_id, created_at desc);
create index if not exists idx_recommendation_sessions_user_created
	on public.recommendation_sessions(user_id, created_at desc);
create index if not exists idx_recommendation_sessions_status
	on public.recommendation_sessions(status);
create index if not exists idx_recommendation_sessions_teme_run
	on public.recommendation_sessions(teme_run_id);

create table if not exists public.recommendation_kpi_snapshots (
	id uuid primary key default gen_random_uuid(),
	session_id uuid not null references public.recommendation_sessions(id) on delete cascade,
	user_id uuid not null references auth.users(id) on delete restrict,
	kpi_name text not null,
	kpi_value numeric not null,
	kpi_unit text,
	period_start date,
	period_end date,
	meta jsonb not null default '{}'::jsonb,
	created_at timestamptz not null default now()
);

create index if not exists idx_recommendation_kpi_session
	on public.recommendation_kpi_snapshots(session_id, created_at desc);
create index if not exists idx_recommendation_kpi_user
	on public.recommendation_kpi_snapshots(user_id, created_at desc);

create table if not exists public.recommendations (
	id uuid primary key default gen_random_uuid(),
	session_id uuid not null references public.recommendation_sessions(id) on delete cascade,
	user_id uuid not null references auth.users(id) on delete restrict,
	rank integer not null default 1 check (rank > 0),
	title text not null,
	summary text not null,
	action_type text not null,
	priority text not null default 'medium' check (priority in ('low', 'medium', 'high', 'critical')),
	status text not null default 'proposed' check (status in ('proposed', 'approved', 'rejected', 'applied')),
	confidence_score numeric not null default 0.0 check (confidence_score >= 0 and confidence_score <= 1),
	estimated_impact_kg_co2e numeric,
	implementation_cost_usd numeric,
	time_to_impact_months integer,
	rationale text,
	recommendation_payload jsonb not null default '{}'::jsonb,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now()
);

create unique index if not exists idx_recommendations_session_rank
	on public.recommendations(session_id, rank);
create index if not exists idx_recommendations_user_created
	on public.recommendations(user_id, created_at desc);
create index if not exists idx_recommendations_status
	on public.recommendations(status);
create index if not exists idx_recommendations_priority
	on public.recommendations(priority);

create table if not exists public.recommendation_evidence (
	id uuid primary key default gen_random_uuid(),
	recommendation_id uuid not null references public.recommendations(id) on delete cascade,
	session_id uuid not null references public.recommendation_sessions(id) on delete cascade,
	user_id uuid not null references auth.users(id) on delete restrict,
	source_type text not null check (source_type in ('teme_run', 'ocr_receipt', 'kpi_snapshot', 'external', 'manual')),
	source_table text,
	source_record_id text,
	uri text,
	citation text,
	excerpt text,
	evidence_payload jsonb not null default '{}'::jsonb,
	created_at timestamptz not null default now()
);

create index if not exists idx_recommendation_evidence_recommendation
	on public.recommendation_evidence(recommendation_id, created_at desc);
create index if not exists idx_recommendation_evidence_session
	on public.recommendation_evidence(session_id, created_at desc);
create index if not exists idx_recommendation_evidence_source
	on public.recommendation_evidence(source_type, source_table);

create table if not exists public.recommendation_feedback (
	id uuid primary key default gen_random_uuid(),
	recommendation_id uuid not null references public.recommendations(id) on delete cascade,
	session_id uuid not null references public.recommendation_sessions(id) on delete cascade,
	user_id uuid not null references auth.users(id) on delete restrict,
	feedback_type text not null check (feedback_type in ('thumbs_up', 'thumbs_down', 'edit', 'apply', 'dismiss')),
	feedback_text text,
	feedback_payload jsonb not null default '{}'::jsonb,
	created_at timestamptz not null default now()
);

create index if not exists idx_recommendation_feedback_recommendation
	on public.recommendation_feedback(recommendation_id, created_at desc);
create index if not exists idx_recommendation_feedback_session
	on public.recommendation_feedback(session_id, created_at desc);
create index if not exists idx_recommendation_feedback_user
	on public.recommendation_feedback(user_id, created_at desc);

-- Triggers for updated_at fields.
do $$
begin
	if not exists (
		select 1
		from pg_trigger
		where tgname = 'set_recommendation_sessions_updated_at'
			and tgrelid = 'public.recommendation_sessions'::regclass
	) then
		create trigger set_recommendation_sessions_updated_at
		before update on public.recommendation_sessions
		for each row execute function public.set_recommendation_updated_at();
	end if;
end $$;

do $$
begin
	if not exists (
		select 1
		from pg_trigger
		where tgname = 'set_recommendations_updated_at'
			and tgrelid = 'public.recommendations'::regclass
	) then
		create trigger set_recommendations_updated_at
		before update on public.recommendations
		for each row execute function public.set_recommendation_updated_at();
	end if;
end $$;

alter table public.recommendation_sessions enable row level security;
alter table public.recommendation_kpi_snapshots enable row level security;
alter table public.recommendations enable row level security;
alter table public.recommendation_evidence enable row level security;
alter table public.recommendation_feedback enable row level security;

-- Remove old/insecure policies if present and recreate strict owner policies.
drop policy if exists "Users can insert recommendation sessions" on public.recommendation_sessions;
drop policy if exists "Users can read recommendation sessions" on public.recommendation_sessions;
drop policy if exists "Users can update recommendation sessions" on public.recommendation_sessions;
drop policy if exists "Users can insert recommendation kpi snapshots" on public.recommendation_kpi_snapshots;
drop policy if exists "Users can read recommendation kpi snapshots" on public.recommendation_kpi_snapshots;
drop policy if exists "Users can insert recommendations" on public.recommendations;
drop policy if exists "Users can read recommendations" on public.recommendations;
drop policy if exists "Users can update recommendations" on public.recommendations;
drop policy if exists "Users can insert recommendation evidence" on public.recommendation_evidence;
drop policy if exists "Users can read recommendation evidence" on public.recommendation_evidence;
drop policy if exists "Users can insert recommendation feedback" on public.recommendation_feedback;
drop policy if exists "Users can read recommendation feedback" on public.recommendation_feedback;

-- Sessions: user must own the row and belong to the org.
create policy recommendation_sessions_select_own
on public.recommendation_sessions
for select
to authenticated
using (
	user_id = auth.uid()
	and exists (
		select 1
		from public.organization_members om
		where om.organization_id = recommendation_sessions.organization_id
			and om.user_id = auth.uid()
			and om.status = 'active'
	)
);

create policy recommendation_sessions_insert_own
on public.recommendation_sessions
for insert
to authenticated
with check (
	user_id = auth.uid()
	and exists (
		select 1
		from public.organization_members om
		where om.organization_id = recommendation_sessions.organization_id
			and om.user_id = auth.uid()
			and om.status = 'active'
	)
);

create policy recommendation_sessions_update_own
on public.recommendation_sessions
for update
to authenticated
using (
	user_id = auth.uid()
	and exists (
		select 1
		from public.organization_members om
		where om.organization_id = recommendation_sessions.organization_id
			and om.user_id = auth.uid()
			and om.status = 'active'
	)
)
with check (
	user_id = auth.uid()
	and exists (
		select 1
		from public.organization_members om
		where om.organization_id = recommendation_sessions.organization_id
			and om.user_id = auth.uid()
			and om.status = 'active'
	)
);

create policy recommendation_sessions_delete_own
on public.recommendation_sessions
for delete
to authenticated
using (
	user_id = auth.uid()
	and exists (
		select 1
		from public.organization_members om
		where om.organization_id = recommendation_sessions.organization_id
			and om.user_id = auth.uid()
			and om.status = 'active'
	)
);

-- KPI snapshots: row owner + parent session owner match.
create policy recommendation_kpi_snapshots_select_own
on public.recommendation_kpi_snapshots
for select
to authenticated
using (
	user_id = auth.uid()
	and exists (
		select 1
		from public.recommendation_sessions s
		where s.id = recommendation_kpi_snapshots.session_id
			and s.user_id = auth.uid()
	)
);

create policy recommendation_kpi_snapshots_insert_own
on public.recommendation_kpi_snapshots
for insert
to authenticated
with check (
	user_id = auth.uid()
	and exists (
		select 1
		from public.recommendation_sessions s
		where s.id = recommendation_kpi_snapshots.session_id
			and s.user_id = auth.uid()
	)
);

create policy recommendation_kpi_snapshots_update_own
on public.recommendation_kpi_snapshots
for update
to authenticated
using (
	user_id = auth.uid()
	and exists (
		select 1
		from public.recommendation_sessions s
		where s.id = recommendation_kpi_snapshots.session_id
			and s.user_id = auth.uid()
	)
)
with check (
	user_id = auth.uid()
	and exists (
		select 1
		from public.recommendation_sessions s
		where s.id = recommendation_kpi_snapshots.session_id
			and s.user_id = auth.uid()
	)
);

-- Recommendations: row owner + parent session owner match.
create policy recommendations_select_own
on public.recommendations
for select
to authenticated
using (
	user_id = auth.uid()
	and exists (
		select 1
		from public.recommendation_sessions s
		where s.id = recommendations.session_id
			and s.user_id = auth.uid()
	)
);

create policy recommendations_insert_own
on public.recommendations
for insert
to authenticated
with check (
	user_id = auth.uid()
	and exists (
		select 1
		from public.recommendation_sessions s
		where s.id = recommendations.session_id
			and s.user_id = auth.uid()
	)
);

create policy recommendations_update_own
on public.recommendations
for update
to authenticated
using (
	user_id = auth.uid()
	and exists (
		select 1
		from public.recommendation_sessions s
		where s.id = recommendations.session_id
			and s.user_id = auth.uid()
	)
)
with check (
	user_id = auth.uid()
	and exists (
		select 1
		from public.recommendation_sessions s
		where s.id = recommendations.session_id
			and s.user_id = auth.uid()
	)
);

create policy recommendations_delete_own
on public.recommendations
for delete
to authenticated
using (
	user_id = auth.uid()
	and exists (
		select 1
		from public.recommendation_sessions s
		where s.id = recommendations.session_id
			and s.user_id = auth.uid()
	)
);

-- Evidence: row owner + parent recommendation owner match.
create policy recommendation_evidence_select_own
on public.recommendation_evidence
for select
to authenticated
using (
	user_id = auth.uid()
	and exists (
		select 1
		from public.recommendations r
		where r.id = recommendation_evidence.recommendation_id
			and r.user_id = auth.uid()
	)
);

create policy recommendation_evidence_insert_own
on public.recommendation_evidence
for insert
to authenticated
with check (
	user_id = auth.uid()
	and exists (
		select 1
		from public.recommendations r
		where r.id = recommendation_evidence.recommendation_id
			and r.user_id = auth.uid()
	)
);

create policy recommendation_evidence_update_own
on public.recommendation_evidence
for update
to authenticated
using (
	user_id = auth.uid()
	and exists (
		select 1
		from public.recommendations r
		where r.id = recommendation_evidence.recommendation_id
			and r.user_id = auth.uid()
	)
)
with check (
	user_id = auth.uid()
	and exists (
		select 1
		from public.recommendations r
		where r.id = recommendation_evidence.recommendation_id
			and r.user_id = auth.uid()
	)
);

create policy recommendation_evidence_delete_own
on public.recommendation_evidence
for delete
to authenticated
using (
	user_id = auth.uid()
	and exists (
		select 1
		from public.recommendations r
		where r.id = recommendation_evidence.recommendation_id
			and r.user_id = auth.uid()
	)
);

-- Feedback: row owner + parent recommendation owner match.
create policy recommendation_feedback_select_own
on public.recommendation_feedback
for select
to authenticated
using (
	user_id = auth.uid()
	and exists (
		select 1
		from public.recommendations r
		where r.id = recommendation_feedback.recommendation_id
			and r.user_id = auth.uid()
	)
);

create policy recommendation_feedback_insert_own
on public.recommendation_feedback
for insert
to authenticated
with check (
	user_id = auth.uid()
	and exists (
		select 1
		from public.recommendations r
		where r.id = recommendation_feedback.recommendation_id
			and r.user_id = auth.uid()
	)
);

create policy recommendation_feedback_update_own
on public.recommendation_feedback
for update
to authenticated
using (
	user_id = auth.uid()
	and exists (
		select 1
		from public.recommendations r
		where r.id = recommendation_feedback.recommendation_id
			and r.user_id = auth.uid()
	)
)
with check (
	user_id = auth.uid()
	and exists (
		select 1
		from public.recommendations r
		where r.id = recommendation_feedback.recommendation_id
			and r.user_id = auth.uid()
	)
);

create policy recommendation_feedback_delete_own
on public.recommendation_feedback
for delete
to authenticated
using (
	user_id = auth.uid()
	and exists (
		select 1
		from public.recommendations r
		where r.id = recommendation_feedback.recommendation_id
			and r.user_id = auth.uid()
	)
);
