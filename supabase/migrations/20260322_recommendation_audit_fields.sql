-- Add audit and evidence fields for recommendation traceability.

alter table public.recommendation_sessions
	add column if not exists input_hash text,
	add column if not exists factor_set_version text,
	add column if not exists methodology_refs jsonb not null default '[]'::jsonb,
	add column if not exists assumptions jsonb not null default '[]'::jsonb;

alter table public.recommendations
	add column if not exists estimated_impact_kg_co2e_low numeric,
	add column if not exists estimated_impact_kg_co2e_high numeric,
	add column if not exists evidence_score numeric not null default 0.0;

create index if not exists idx_recommendations_evidence_score
	on public.recommendations(evidence_score desc);
