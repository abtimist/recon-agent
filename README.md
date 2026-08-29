# Recon Agent — Multi-Tenant SaaS

AI-powered financial reconciliation as a multi-tenant SaaS.

## Architecture

- **Frontend**: Next.js 16 + Clerk auth (App Router)
- **Backend API**: FastAPI (Python)
- **Core Engine**: Pure Python reconciliation logic (`core/`)
- **Database**: Supabase PostgreSQL with RLS
- **Storage**: Supabase Storage (CSV/XLSX files)

The architecture flows strictly as:
`Web → FastAPI API → Core Engine → Database`

> [!WARNING]
> The Command Line Interface (`cli.py`) is currently under reconstruction and is **not** yet the production interface. It will be rebuilt in a future phase to consume the FastAPI REST API using Personal Access Tokens (PATs).

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

## Command Line Interface (CLI)

Recon Agent includes a powerful CLI that acts as a first-class client to the FastAPI backend. It allows you to automate reconciliations, view history, export reports, and generate AI explanations straight from the terminal.

### Installation

Install locally via pip or uv:

```bash
pip install -e .
# or
uv pip install -e .
```

This makes the `recon` command globally available. 

```bash
recon --help
```

### Usage

1. **Login**: Generate a Personal Access Token in the Web UI, then run:
   ```bash
   recon login
   ```
2. **Reconcile**:
   ```bash
   recon reconcile source.csv target.csv
   ```
3. **History**:
   ```bash
   recon history
   ```
4. **Machine Readable output**:
   ```bash
   recon history --json
   ```

## Documentation

- [Docs Directory](docs/)
- [Phase 1: Feature 1–7 Audit](docs/platform-integration-audit.md)
- [Phase 2: Platform Foundations](docs/phase-2-foundations-report.md)
- [Phase 3: API Authentication](docs/api-authentication.md)
- [Phase 4: CLI Documentation](docs/cli.md)

## Development

```bash
uv sync
```
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

## What's NOT in scope for Phase 2

- The new Typer CLI has not been built yet.
- Personal Access Tokens (PATs) for machine-to-machine authentication do not exist yet.
- RBAC and subscription tiers are planned but not yet enforced.

See `api/migrations/001_initial_schema.sql` to `003_org_ai_config.sql` for the full schema.
