-- migrations/007_explain_queue.sql
-- Queue table for AI explanations

BEGIN;

CREATE TABLE IF NOT EXISTS explain_jobs (
    id              uuid primary key default gen_random_uuid(),
    org_id          uuid not null references organizations(id) on delete cascade,
    clerk_user_id   text not null,
    job_type        text not null, -- 'single' or 'batch'
    status          text not null default 'queued',
    request_data    jsonb not null,
    response_data   jsonb,
    error_message   text,
    created_at      timestamptz default now(),
    completed_at    timestamptz
);

CREATE INDEX IF NOT EXISTS idx_explain_jobs_status ON explain_jobs(status);
CREATE INDEX IF NOT EXISTS idx_explain_jobs_org_id ON explain_jobs(org_id);

ALTER TABLE explain_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY explain_jobs_select_policy ON explain_jobs
    FOR SELECT
    USING (
        org_id IN (
            SELECT org_id FROM organization_members
            WHERE clerk_user_id = auth.jwt()->>'sub'
        )
    );

CREATE POLICY explain_jobs_insert_policy ON explain_jobs
    FOR INSERT
    WITH CHECK (
        org_id IN (
            SELECT org_id FROM organization_members
            WHERE clerk_user_id = auth.jwt()->>'sub'
        )
    );

COMMIT;
