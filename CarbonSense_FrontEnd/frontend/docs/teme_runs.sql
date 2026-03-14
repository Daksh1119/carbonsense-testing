-- TEME runs storage for frontend-driven history
create table if not exists public.teme_runs (
	id uuid primary key default gen_random_uuid(),
	user_id text not null,
	project_name text not null,
	emission_kg numeric not null,
	input_payload jsonb not null,
	result jsonb not null,
	total_trees integer not null,
	confidence_score numeric not null,
	time_to_neutral_years numeric not null,
	land_required_hectare numeric not null,
	status text not null default 'completed' check (status in ('pending', 'completed', 'infeasible')),
	created_at timestamptz not null default now()
);

create index if not exists idx_teme_runs_user_created on public.teme_runs(user_id, created_at desc);
create index if not exists idx_teme_runs_status on public.teme_runs(status);

alter table public.teme_runs enable row level security;

do $$
begin
	if not exists (
		select 1
		from pg_policies
		where schemaname = 'public'
			and tablename = 'teme_runs'
			and policyname = 'Users can insert TEME runs'
	) then
		create policy "Users can insert TEME runs"
		on public.teme_runs
		for insert
		to anon, authenticated
		with check (user_id is not null and length(user_id) > 0);
	end if;
end $$;

do $$
begin
	if not exists (
		select 1
		from pg_policies
		where schemaname = 'public'
			and tablename = 'teme_runs'
			and policyname = 'Users can read TEME runs'
	) then
		create policy "Users can read TEME runs"
		on public.teme_runs
		for select
		to anon, authenticated
		using (user_id is not null and length(user_id) > 0);
	end if;
end $$;
