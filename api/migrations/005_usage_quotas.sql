-- migrations/005_usage_quotas.sql

BEGIN;

create table if not exists organization_usage (
    id              uuid primary key default gen_random_uuid(),
    org_id          uuid references organizations(id) on delete cascade,
    billing_period  text not null, -- e.g., '2026-08'
    recon_runs_used int default 0,
    created_at      timestamptz default now(),
    updated_at      timestamptz default now()
);

-- Unique constraint so we can upsert easily
create unique index if not exists idx_org_usage_period
    on organization_usage (org_id, billing_period);

-- RLS
alter table organization_usage enable row level security;

drop policy if exists organization_usage_select_policy on organization_usage;
create policy organization_usage_select_policy on organization_usage
    for select
    using (
        exists (
            select 1 from organization_members
            where org_id = organization_usage.org_id
            and clerk_user_id = auth.jwt()->>'sub'
        )
    );

-- We only allow service role to insert/update usage directly, 
-- or we can allow users to do it if they belong to the org.
-- In our architecture, the API runs queries via service key,
-- so we don't strictly need insert/update RLS for the users.
-- But we can add them for completeness.

COMMIT;
