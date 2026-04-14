-- Policy Intelligence + Compliance foundation schema
-- Includes tables from implementation plan and RAG-ready storage.

create extension if not exists pgcrypto;
create extension if not exists vector;

create table if not exists public.policies (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    short_name text,
    category text not null,
    layer text not null,
    description text not null,
    authority text,
    applicability text[] not null default '{}',
    requirements text[] not null default '{}',
    benefits text[] not null default '{}',
    is_active boolean not null default true,
    effective_date date,
    review_date date,
    external_url text,
    created_at timestamptz not null default now(),
    constraint policies_category_check check (
        category = any (
            array[
                'energy'::text,
                'renewable'::text,
                'waste'::text,
                'environmental'::text,
                'esg'::text,
                'carbon_market'::text,
                'transport'::text,
                'msme'::text,
                'reporting'::text,
                'climate'::text,
                'trade'::text
            ]
        )
    ),
    constraint policies_layer_check check (
        layer = any (array['core'::text, 'secondary'::text, 'optional'::text, 'future'::text, 'background'::text, 'advanced'::text])
    )
);

create unique index if not exists idx_policies_name_unique on public.policies(lower(name));
create index if not exists idx_policies_category on public.policies(category);
create index if not exists idx_policies_active_layer on public.policies(is_active, layer);

create table if not exists public.compliance_requirements (
    id uuid primary key default gen_random_uuid(),
    policy_id uuid not null references public.policies(id) on delete cascade,
    name text not null,
    type text not null,
    level text not null,
    industry text[] not null default '{}',
    verification_method text not null,
    description text not null,
    is_mandatory boolean not null default true,
    weight numeric not null default 1,
    estimated_rupee_impact numeric,
    estimated_co2_kg_impact numeric,
    created_at timestamptz not null default now(),
    constraint compliance_requirements_type_check check (
        type = any (array['data'::text, 'action'::text, 'reporting'::text])
    ),
    constraint compliance_requirements_level_check check (
        level = any (array['basic'::text, 'industry_specific'::text, 'action_based'::text])
    ),
    constraint compliance_requirements_verification_method_check check (
        verification_method = any (
            array['data_change'::text, 'evidence_upload'::text, 'ocr_extract'::text, 'manual'::text]
        )
    )
);

create index if not exists idx_compliance_requirements_policy on public.compliance_requirements(policy_id);
create index if not exists idx_compliance_requirements_type_level on public.compliance_requirements(type, level);

create table if not exists public.compliance_results (
    id uuid primary key default gen_random_uuid(),
    organization_id uuid not null references public.organizations(id) on delete cascade,
    requirement_id uuid not null references public.compliance_requirements(id) on delete cascade,
    status text not null default 'not_started',
    verified boolean not null default false,
    verification_source text,
    evidence_url text,
    data_snapshot jsonb not null default '{}'::jsonb,
    score_contribution numeric not null default 0,
    due_date date,
    completed_at timestamptz,
    notes text,
    updated_at timestamptz not null default now(),
    created_at timestamptz not null default now(),
    constraint compliance_results_status_check check (
        status = any (array['not_started'::text, 'in_progress'::text, 'completed'::text, 'overdue'::text, 'verified'::text])
    ),
    constraint compliance_results_verification_source_check check (
        verification_source is null
        or verification_source = any (array['data'::text, 'evidence'::text, 'ocr'::text, 'llm'::text])
    ),
    constraint compliance_results_org_requirement_unique unique (organization_id, requirement_id)
);

create index if not exists idx_compliance_results_org_status on public.compliance_results(organization_id, status);
create index if not exists idx_compliance_results_due_date on public.compliance_results(organization_id, due_date);
create index if not exists idx_compliance_results_verified on public.compliance_results(organization_id, verified);

create table if not exists public.compliance_score_history (
    id uuid primary key default gen_random_uuid(),
    organization_id uuid not null references public.organizations(id) on delete cascade,
    snapshot_date date not null,
    data_score numeric not null default 0,
    action_score numeric not null default 0,
    reporting_score numeric not null default 0,
    total_score numeric not null default 0,
    breakdown jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    constraint compliance_score_history_unique unique (organization_id, snapshot_date)
);

create index if not exists idx_compliance_score_history_org_date on public.compliance_score_history(organization_id, snapshot_date desc);

create table if not exists public.policy_interactions (
    id uuid primary key default gen_random_uuid(),
    organization_id uuid not null references public.organizations(id) on delete cascade,
    policy_id uuid references public.policies(id) on delete set null,
    user_question text not null,
    llm_response text not null,
    model_used text,
    created_at timestamptz not null default now()
);

create index if not exists idx_policy_interactions_org_created on public.policy_interactions(organization_id, created_at desc);
create index if not exists idx_policy_interactions_policy on public.policy_interactions(policy_id);

-- RAG-ready chunks for grounded policy answers.
create table if not exists public.policy_chunks (
    id uuid primary key default gen_random_uuid(),
    policy_id uuid not null references public.policies(id) on delete cascade,
    chunk_text text not null,
    chunk_order integer not null default 0,
    source text not null default 'policies_table',
    embedding vector(1536),
    created_at timestamptz not null default now()
);

create index if not exists idx_policy_chunks_policy on public.policy_chunks(policy_id, chunk_order);

-- Optional ANN index for pgvector similarity search.
create index if not exists idx_policy_chunks_embedding_ivfflat
    on public.policy_chunks
    using ivfflat (embedding vector_cosine_ops)
    with (lists = 100);

create or replace function public.match_policy_chunks(
    query_embedding vector(1536),
    match_count integer default 5,
    filter_policy_id uuid default null
)
returns table (
    id uuid,
    policy_id uuid,
    chunk_text text,
    similarity double precision
)
language sql
stable
as $$
    select
        c.id,
        c.policy_id,
        c.chunk_text,
        1 - (c.embedding <=> query_embedding) as similarity
    from public.policy_chunks c
    where c.embedding is not null
      and (filter_policy_id is null or c.policy_id = filter_policy_id)
    order by c.embedding <=> query_embedding
    limit greatest(match_count, 1);
$$;

create or replace function public.touch_compliance_results_updated_at()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language plpgsql;

drop trigger if exists trg_touch_compliance_results_updated_at on public.compliance_results;
create trigger trg_touch_compliance_results_updated_at
before update on public.compliance_results
for each row execute function public.touch_compliance_results_updated_at();
