BEGIN;

-- Create the new org_ai_config table
create table if not exists org_ai_config (
    id                  uuid primary key default gen_random_uuid(),
    org_id              uuid references organizations(id) on delete cascade unique not null,
    provider            text not null default 'groq',
    encrypted_api_key   text,
    model_override      text,
    base_url_override   text,
    updated_at          timestamptz default now()
);

-- Migrate existing data from user_ai_config to org_ai_config
-- Using the most recently updated config for a given org if multiple users exist
INSERT INTO org_ai_config (org_id, provider, encrypted_api_key, model_override, base_url_override, updated_at)
SELECT 
    m.org_id, 
    u.provider, 
    u.encrypted_api_key, 
    u.model_override, 
    u.base_url_override, 
    u.updated_at
FROM user_ai_config u
JOIN organization_members m ON u.clerk_user_id = m.clerk_user_id
ON CONFLICT (org_id) DO UPDATE SET
    provider = EXCLUDED.provider,
    encrypted_api_key = EXCLUDED.encrypted_api_key,
    model_override = EXCLUDED.model_override,
    base_url_override = EXCLUDED.base_url_override,
    updated_at = EXCLUDED.updated_at
WHERE org_ai_config.updated_at < EXCLUDED.updated_at;

-- Set up Row Level Security
alter table org_ai_config enable row level security;

create policy org_ai_config_select_policy on org_ai_config
    for select
    using (
        org_id IN (
            select org_id from organization_members
            where clerk_user_id = auth.jwt()->>'sub'
        )
    );

create policy org_ai_config_insert_policy on org_ai_config
    for insert
    with check (
        org_id IN (
            select org_id from organization_members
            where clerk_user_id = auth.jwt()->>'sub'
        )
    );

create policy org_ai_config_update_policy on org_ai_config
    for update
    using (
        org_id IN (
            select org_id from organization_members
            where clerk_user_id = auth.jwt()->>'sub'
        )
    );

COMMIT;
