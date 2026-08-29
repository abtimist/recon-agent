BEGIN;

CREATE TABLE api_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    clerk_user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    token_prefix TEXT NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    scopes TEXT[] DEFAULT '{"reconcile", "history", "export", "read", "write"}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_used_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ
);

-- Indexes for fast lookup
CREATE INDEX idx_api_tokens_org_id ON api_tokens(org_id);
CREATE INDEX idx_api_tokens_token_hash ON api_tokens(token_hash);
CREATE INDEX idx_api_tokens_clerk_user_id ON api_tokens(clerk_user_id);

-- Enable RLS
ALTER TABLE api_tokens ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see tokens for their organization
CREATE POLICY "Users can view org tokens"
ON api_tokens FOR SELECT
USING (
    org_id IN (
        SELECT org_id FROM organization_members
        WHERE clerk_user_id = auth.jwt()->>'sub'
    )
);

-- Policy: Users can only insert tokens for their organization
CREATE POLICY "Users can insert org tokens"
ON api_tokens FOR INSERT
WITH CHECK (
    org_id IN (
        SELECT org_id FROM organization_members
        WHERE clerk_user_id = auth.jwt()->>'sub'
    )
);

-- Policy: Users can only update tokens for their organization
CREATE POLICY "Users can update org tokens"
ON api_tokens FOR UPDATE
USING (
    org_id IN (
        SELECT org_id FROM organization_members
        WHERE clerk_user_id = auth.jwt()->>'sub'
    )
)
WITH CHECK (
    org_id IN (
        SELECT org_id FROM organization_members
        WHERE clerk_user_id = auth.jwt()->>'sub'
    )
);

-- Service Role Policy (The Python backend accesses the DB using service role, bypassing RLS)
-- Since the FastAPI uses a service role (based on SUPABASE_SERVICE_KEY), it bypasses RLS anyway, 
-- but we declare explicit RLS to ensure that if a frontend accesses it, it respects org isolation.
-- Wait, the prompt states: "The backend uses SUPABASE_SERVICE_KEY... but we enforce org_id in Python".
-- Actually, the backend might use the service key and enforce org_id in python queries.
-- That's exactly how it works currently, so the RLS is a backstop for potential direct access.

COMMIT;
