# Recon Agent - API Backend

This directory contains the **FastAPI** backend for Recon Agent. It is the central nervous system of the application, connecting the Web UI and CLI to the database and the Core Reconciliation Engine.

## Tech Stack
- **Framework:** FastAPI (Python)
- **Database Access:** Supabase PostgREST client
- **Security:** JWT Validation (via Clerk), Row Level Security (RLS)
- **Data Validation:** Pydantic models

## API Modules Overview

* `routes/auth.py` - Validates JWTs, handles Identity management and scopes.
* `routes/reconcile.py` - Exposes endpoints to queue single or batch reconciliation jobs.
* `routes/history.py` - Fetches and formats previous runs and batch histories for the dashboards.
* `routes/reports.py` - Generates downloadable Excel and PDF reports.
* `routes/tokens.py` - Allows users to generate Personal Access Tokens (PATs) for CLI usage.

## Development Setup

1. Make sure your Python virtual environment is activated in the root directory.
2. Ensure you have the `SUPABASE_SERVICE_KEY`, `SUPABASE_URL`, and `CLERK_SECRET_KEY` in the root `.env` file.
3. Start the server (from the root directory):
   ```bash
   .venv/bin/python -m uvicorn api.main:app --host 0.0.0.0 --port 8000 --reload
   ```

## Security Model (Multi-Tenancy)
The API leverages Clerk's JWTs to parse the `clerk_org_id` of the user. Every database query strictly filters by this Organization ID, ensuring that a user in one company can never access the reconciliation records of another.
