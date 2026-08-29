-- migrations/002_history_schema.sql
-- Extensions to the schema for Feature 6: Reconciliation History

BEGIN;

-- 1. Create recon_batches table
CREATE TABLE IF NOT EXISTS recon_batches (
    id              uuid primary key,
    org_id          uuid not null references organizations(id) on delete cascade,
    clerk_user_id   text not null,
    status          text not null, -- 'processing', 'completed', 'failed'
    summary         jsonb,         -- Stores the BatchSummary
    created_at      timestamptz default now(),
    completed_at    timestamptz
);

-- Index for fast tenant lookups
CREATE INDEX IF NOT EXISTS idx_recon_batches_org_id ON recon_batches(org_id);

-- 2. Alter recon_runs table to add new columns
ALTER TABLE recon_runs
    ADD COLUMN IF NOT EXISTS batch_id uuid references recon_batches(id) on delete cascade,
    ADD COLUMN IF NOT EXISTS amount_tolerance double precision,
    ADD COLUMN IF NOT EXISTS date_window_days integer,
    ADD COLUMN IF NOT EXISTS duplicates jsonb,
    ADD COLUMN IF NOT EXISTS summary jsonb;

-- Index for finding runs in a batch
CREATE INDEX IF NOT EXISTS idx_recon_runs_batch_id ON recon_runs(batch_id);

COMMIT;
