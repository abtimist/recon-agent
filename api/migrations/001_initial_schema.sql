-- migrations/001_initial_schema.sql
-- Initial database schema for the Recon Agent API

BEGIN;

-- Enable required extensions
create extension if not exists "uuid-ossp" with schema "public";

-- organizations table
create table if not exists organizations (
    id              uuid primary key default gen_random_uuid(),
    clerk_org_id    text unique not null,   -- Clerk organization ID
    name            text not null,
    plan            text default 'free',    -- 'free' | 'pro' | 'enterprise'
    created_at      timestamptz default now()
);

-- user_ai_config table
create table if not exists user_ai_config (
    id                  uuid primary key default gen_random_uuid(),
    clerk_user_id       text unique not null,
    provider            text not null default 'groq',
    encrypted_api_key   text,
    model_override      text,
    base_url_override   text,
    updated_at          timestamptz default now()
);

-- column_mapping_templates table
create table if not exists column_mapping_templates (
    id              uuid primary key default gen_random_uuid(),
    org_id          uuid references organizations(id) on delete cascade,
    name            text not null,          -- e.g. "Razorpay", "HDFC Bank"
    source_type     text,                   -- 'source' | 'target'
    mappings        jsonb not null,         -- the mapping dict
    amount_mode     text default 'single',
    created_at      timestamptz default now()
);

-- recon_runs table
create table if not exists recon_runs (
    id                  uuid primary key default gen_random_uuid(),
    org_id              uuid references organizations(id) on delete cascade,
    clerk_user_id       text not null,
    status              text default 'processing',  -- 'processing' | 'completed' | 'failed'
    source_filename     text,
    target_filename     text,
    source_file_url     text,    -- Supabase Storage path
    target_file_url     text,    -- Supabase Storage path
    total_source_rows   int,
    total_matched       int,
    match_rate          float,
    exact_matches       int,
    fuzzy_matches       int,
    ai_matches          int,
    exceptions_count    int,
    exception_report    jsonb,   -- full exception list
    ai_provider         text,
    error_message       text,    -- populated on failure
    created_at          timestamptz default now(),
    completed_at        timestamptz
);

-- organization_members table for RLS
create table if not exists organization_members (
    id            uuid primary key default gen_random_uuid(),
    org_id        uuid references organizations(id) on delete cascade,
    clerk_user_id text not null,
    role          text default 'member',  -- 'admin' | 'member'
    created_at    timestamptz default now()
);

create unique index if not exists idx_organization_members_unique
    on organization_members (org_id, clerk_user_id);

-- Enable Row-Level Security
alter table organizations enable row level security;
alter table user_ai_config enable row level security;
alter table column_mapping_templates enable row level security;
alter table recon_runs enable row level security;
alter table organization_members enable row level security;

-- RLS policies for organizations
drop policy if exists organizations_select_policy on organizations;
create policy organizations_select_policy on organizations
    for select
    using (
        exists (
            select 1 from organization_members
            where org_id = organizations.id
            and clerk_user_id = auth.jwt()->>'sub'
        )
    );

drop policy if exists organizations_insert_policy on organizations;
create policy organizations_insert_policy on organizations
    for insert
    with check (false);

-- RLS policies for user_ai_config
drop policy if exists user_ai_config_select_policy on user_ai_config;
create policy user_ai_config_select_policy on user_ai_config
    for select
    using (clerk_user_id = auth.jwt()->>'sub');

drop policy if exists user_ai_config_insert_policy on user_ai_config;
create policy user_ai_config_insert_policy on user_ai_config
    for insert
    with check (clerk_user_id = auth.jwt()->>'sub');

drop policy if exists user_ai_config_update_policy on user_ai_config;
create policy user_ai_config_update_policy on user_ai_config
    for update
    using (clerk_user_id = auth.jwt()->>'sub');

-- RLS policies for column_mapping_templates
drop policy if exists column_mapping_templates_select_policy on column_mapping_templates;
create policy column_mapping_templates_select_policy on column_mapping_templates
    for select
    using (
        exists (
            select 1 from organization_members
            where org_id = column_mapping_templates.org_id
            and clerk_user_id = auth.jwt()->>'sub'
        )
    );

drop policy if exists column_mapping_templates_insert_policy on column_mapping_templates;
create policy column_mapping_templates_insert_policy on column_mapping_templates
    for insert
    with check (
        exists (
            select 1 from organization_members
            where org_id = column_mapping_templates.org_id
            and clerk_user_id = auth.jwt()->>'sub'
        )
    );

drop policy if exists column_mapping_templates_update_policy on column_mapping_templates;
create policy column_mapping_templates_update_policy on column_mapping_templates
    for update
    using (
        exists (
            select 1 from organization_members
            where org_id = column_mapping_templates.org_id
            and clerk_user_id = auth.jwt()->>'sub'
        )
    );

drop policy if exists column_mapping_templates_delete_policy on column_mapping_templates;
create policy column_mapping_templates_delete_policy on column_mapping_templates
    for delete
    using (
        exists (
            select 1 from organization_members
            where org_id = column_mapping_templates.org_id
            and clerk_user_id = auth.jwt()->>'sub'
        )
    );

-- RLS policies for recon_runs
drop policy if exists recon_runs_select_policy on recon_runs;
create policy recon_runs_select_policy on recon_runs
    for select
    using (
        org_id IN (
            select org_id from organization_members
            where clerk_user_id = auth.jwt()->>'sub'
        )
    );

drop policy if exists recon_runs_insert_policy on recon_runs;
create policy recon_runs_insert_policy on recon_runs
    for insert
    with check (
        org_id IN (
            select org_id from organization_members
            where clerk_user_id = auth.jwt()->>'sub'
        )
    );

drop policy if exists recon_runs_update_policy on recon_runs;
create policy recon_runs_update_policy on recon_runs
    for update
    using (
        org_id IN (
            select org_id from organization_members
            where clerk_user_id = auth.jwt()->>'sub'
        )
    );

drop policy if exists recon_runs_delete_policy on recon_runs;
create policy recon_runs_delete_policy on recon_runs
    for delete
    using (
        org_id IN (
            select org_id from organization_members
            where clerk_user_id = auth.jwt()->>'sub'
        )
    );

-- RLS policies for organization_members
drop policy if exists organization_members_select_policy on organization_members;
create policy organization_members_select_policy on organization_members
    for select
    using (
        org_id IN (
            select org_id from organization_members
            where clerk_user_id = auth.jwt()->>'sub'
        )
    );

drop policy if exists organization_members_insert_policy on organization_members;
create policy organization_members_insert_policy on organization_members
    for insert
    with check (clerk_user_id = auth.jwt()->>'sub');

drop policy if exists organization_members_update_policy on organization_members;
create policy organization_members_update_policy on organization_members
    for update
    using (
        org_id IN (
            select org_id from organization_members
            where clerk_user_id = auth.jwt()->>'sub'
        )
    );

drop policy if exists organization_members_delete_policy on organization_members;
create policy organization_members_delete_policy on organization_members
    for delete
    using (
        org_id IN (
            select org_id from organization_members
            where clerk_user_id = auth.jwt()->>'sub'
        )
    );

COMMIT;
