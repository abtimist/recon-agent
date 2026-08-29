-- migrations/006_job_queue.sql
-- Extensions to the schema for Phase 6: Durable Job Processing

BEGIN;

-- Add config jsonb to recon_runs to store mappings and settings for the worker
ALTER TABLE recon_runs
    ADD COLUMN IF NOT EXISTS config jsonb;

-- Add index on status for fast worker polling
CREATE INDEX IF NOT EXISTS idx_recon_runs_status ON recon_runs(status);

COMMIT;
