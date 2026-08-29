# Recon Agent — Multi-Tenant SaaS

AI-powered financial reconciliation as a multi-tenant SaaS.

## Architecture

- **Frontend**: Next.js 16 + Clerk auth (App Router)
- **Backend**: FastAPI (Python) — wraps `core/` engine
- **Database**: Supabase PostgreSQL with RLS
- **Storage**: Supabase Storage (CSV/XLSX files)

## Quick Start

### 1. Backend (FastAPI)

```bash
cd /home/abhishek/PROJECTS/recon-agent
.venv/bin/python -m uvicorn api.main:app --host 0.0.0.0 --port 8000 --reload
```

Health check: `curl http://localhost:8000/health`

### 2. Frontend (Next.js)

```bash
cd /home/abhishek/PROJECTS/recon-agent/web
npm run dev
```

Visit: `http://localhost:3000`

## Required Environment Variables

Create `.env` (root) and `web/.env.local` with these values.

### Root `.env`
```
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_SERVICE_KEY=<service_role JWT>      # NOT the publishable key!
CLERK_SECRET_KEY=sk_test_...
CLERK_ISSUER=https://<your-app>.clerk.accounts.dev
ENCRYPTION_KEY=<base64 32 bytes>
```

### `web/.env.local`
```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
```

## Database Setup

Run the SQL in `api/migrations/001_initial_schema.sql` in the Supabase SQL editor.

This creates the tables and enables RLS policies.

## How multi-tenancy works

1. User signs in with Clerk (organizations enabled)
2. Clerk JWT is sent on every API request
3. Backend extracts `clerk_org_id` from JWT
4. Each DB query is scoped to that org — RLS enforces isolation as a backstop

## What's NOT in scope

- `core/` (file_reader, column_mapper, matcher, ai_resolver) is unchanged
- `cli.py` is unchanged

See `api/migrations/001_initial_schema.sql` for the full schema.
