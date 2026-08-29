# Phase 6: Production Readiness Audit (Revised)

## 1. Executive Summary

**Is the current architecture suitable for a production SaaS?**
Yes. The foundational architecture (Next.js → FastAPI → PostgreSQL/Supabase) is extremely sound for a public, multi-tenant SaaS. You have correctly enforced strict JWT/PAT identity separation, API-level quotas, Row-Level Security (RLS), and API-as-the-single-source-of-truth. 

**Have we accidentally built a local application instead of a SaaS?**
No. You have built a proper SaaS architecture but currently rely on local-development deployment shortcuts (synchronous API endpoints, bundled CLI packaging, hardcoded local URLs). The gap is primarily in **distribution, configuration, and durable execution**, not a fundamental architectural flaw. We do not need to rebuild Phases 1–5.

**What is the minimum required infrastructure for launch?**
1. Supabase (Database/Storage/Auth backend)
2. FastAPI API App (e.g., Render/Railway web service)
3. Background Worker App (e.g., Render/Railway background worker)
4. Next.js Frontend (e.g., Vercel)
5. PyPI (for CLI distribution)

---

## 2. Production Architecture

The revised, highly scalable production architecture separates the API from heavy processing:

```mermaid
graph TD
    subgraph Client Layer
        Web[Next.js Frontend\nrecon-agent.com]
        CLI[Recon CLI\npip install recon-agent]
    end
    
    subgraph API Layer (Fast)
        API[FastAPI\napi.recon-agent.com]
    end
    
    subgraph Background Execution Layer
        Worker[Python Worker Process\nPolling / SKIP LOCKED]
        Engine[Core Engine]
    end

    subgraph Data Layer
        DB[(Supabase PostgreSQL)]
        Storage[(Supabase Storage)]
    end

    Web -- Clerk JWT (HTTPS) --> API
    CLI -- PAT (HTTPS) --> API
    
    API -- "1. Insert Job (queued)\n2. Return 202 Accepted" --> DB
    
    Worker -- "3. Polls DB for 'queued'" --> DB
    Worker -- "4. Executes" --> Engine
    Engine -- "5. Stores Results (completed/failed)" --> DB
    Engine -- "Reads/Writes CSV" --> Storage
    
    Web -. "6. Polls Status" .-> API
    CLI -. "6. Polls Status" .-> API
```

---

## 3. Web Deployment

**Deployment Target:** Vercel or Netlify.
**Requirements:**
- Frontend calls the API via HTTPS over the public internet.
- Must consume `NEXT_PUBLIC_API_URL` correctly.
- Must be updated to poll for job completion rather than waiting for a single synchronous POST response.

---

## 4. API Deployment

**Deployment Target:** Render, Railway, AWS AppRunner, etc.
**Requirements:**
- Runs via Uvicorn behind a cloud load balancer enforcing HTTPS.
- The heavy lifting in `POST /reconcile` and `POST /explain` must be removed. The endpoints will quickly parse the request, upload the file to Supabase Storage, insert a row into `recon_runs` with `status='queued'`, and immediately return `202 Accepted`.
- CORS must be configured via environment variables (`CORS_ORIGINS`).

---

## 5. Database, Storage, and Durable Job Processing

**Can Supabase/Postgres serve as the initial durable job queue?**
**Yes.** We do not need Celery or Redis. We already have a `recon_runs` table. We simply need to add a `queued` status and an `error_message` column. A standalone `worker.py` process can poll this table. To handle concurrency (if scaling to multiple workers), we can use a Postgres RPC function with `FOR UPDATE SKIP LOCKED` to safely claim jobs without race conditions.

**Is async Supabase actually necessary?**
**No.** The original concern was that the synchronous `supabase-py` HTTP client would block the API's `asyncio` event loop. However, once we remove the massive reconciliation logic from the API and move it to the background worker, the API endpoints only perform extremely fast database inserts (milliseconds). 

To prevent these fast inserts from blocking the event loop in `async def` routes, we can simply define our FastAPI routes as standard `def` functions. FastAPI automatically runs standard `def` routes in a managed threadpool, ensuring maximum concurrency without forcing a massive `.execute()` to `await .execute()` refactor across the entire codebase.

---

## 6. CLI Distribution

**Current Flaw:** `pip install -e .` blindly packages the `core` and `api` folders alongside the CLI, meaning customers would download proprietary backend source code. 

**Target Distribution (PyPI):**
- The package name `recon-agent` is available on PyPI (returns 404). We will register it.
- **How a completely new customer installs it:**
  They run `pip install recon-agent`. They do not clone GitHub. They do not run localhost.
- **How it discovers the API:**
  `recon_cli/config.py` will hardcode the production URL (`https://api.recon-agent.com`) as the default. Developers can override this locally using `export RECON_API_URL=http://localhost:8000`.
- **Packaging:** We will update `pyproject.toml` so that `packages = ["recon_cli"]`. The wheel built for PyPI will strictly contain the CLI client code. The backend is never shipped to customers.

---

## 7. Environment Configuration

| Variable | Used By | Development | Production | Secret? |
| :--- | :--- | :--- | :--- | :--- |
| `SUPABASE_URL` | API, Worker | `https://<dev>.supabase.co` | `https://<prod>.supabase.co` | No |
| `SUPABASE_SERVICE_KEY` | API, Worker | `<dev-key>` | `<prod-key>` | **Yes** |
| `DATABASE_URL` | Worker | `postgresql://...` (direct) | `postgresql://...` (direct) | **Yes** |
| `CLERK_SECRET_KEY` | API | `sk_test_...` | `sk_live_...` | **Yes** |
| `CLERK_ISSUER` | API | `https://<dev>.clerk.accounts.dev` | `https://accounts.recon-agent.com` | No |
| `ENCRYPTION_KEY` | API | `base64...` | `base64...` | **Yes** |
| `CORS_ORIGINS` | API | `http://localhost:3000` | `https://recon-agent.com` | No |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Web | `pk_test_...` | `pk_live_...` | No |
| `NEXT_PUBLIC_API_URL` | Web | `http://localhost:8000` | `https://api.recon-agent.com` | No |

*Note: The Next.js frontend is fully isolated from Supabase credentials and encryption keys.*

---

## 8. Security Audit

- **Authentication / JWT / PATs:** Production ready. Verification strictly follows the single-source-of-truth model.
- **RBAC / Quotas:** Production ready. Protected at the FastAPI router dependency layer.
- **RLS / Tenancy:** Production ready. Tenant isolation uses `org_id` reliably across all tables.
- **HTTPS & CORS:** Currently hardcoded for dev; needs environment variable adoption for prod.
- **Upload Limits:** The API currently has no upload limit. We need a FastAPI middleware to enforce a maximum payload size (e.g., 50MB) to prevent OOM attacks.
- **Rate Limiting:** We have quota tracking, but lack burst rate-limiting. A simple ASGI rate limiter or Cloudflare WAF rule is highly recommended before launch.

---

## 9. Multi-Tenant Scalability

- **10 to 100 Organizations:** No database or isolation bottlenecks.
- **Simultaneous large jobs:** Once moved to the `worker.py` polling queue, the API will remain fast. The worker will process jobs sequentially (or concurrently, depending on worker count). Large CSVs won't crash the API load balancer.
- **Simultaneous AI explanations:** The worker will execute these. Since LLM calls take time, having multiple workers or an async worker processing the queue is ideal. A single Python worker might form a backlog; scaling workers horizontally on Render/Railway will solve this linearly.

---

## 10. Explicit Answers to Final Questions

1. **Did we accidentally build a local application instead of a SaaS?** No, you built a robust SaaS architecture but used local-development shortcuts for deployment and background processing.
2. **How much of Phases 1–5 actually needs to change?** The core engine, database schema, and authentication remain untouched. Only the HTTP request lifecycle (sync to polling) and CLI packaging (isolating the CLI code) need changing.
3. **Is the current architecture fundamentally correct?** Yes. The separation of Web/CLI as clients against a central, stateless FastAPI backend backed by PostgreSQL is standard enterprise architecture.
4. **What is the minimum required infrastructure for launch?** Web Hosting (Vercel), API Hosting (Render), Background Worker Hosting (Render), Database/Storage (Supabase).
5. **How will a new customer install the CLI?** `pip install recon-agent` via PyPI. No GitHub cloning.
6. **How does the CLI discover the production API?** By defaulting to `https://api.recon-agent.com` internally.
7. **How do long-running jobs survive API restarts?** The API immediately inserts a `queued` row into `recon_runs` and responds `202`. A separate `worker.py` process claims the job from the DB, ensuring survival across API restarts.
8. **Can Supabase/Postgres serve as the initial durable queue?** Absolutely. A `status` column combined with a `SKIP LOCKED` query is a proven, robust queuing mechanism for this scale.
9. **Is async Supabase actually necessary?** No. Shifting heavy work to the background worker keeps API requests extremely fast. Running standard `def` endpoints in FastAPI's threadpool prevents the fast DB inserts from blocking the event loop.
10. **What must be completed before the first public customer can use Recon Agent?** (1) Fix CLI packaging, (2) Implement the durable queue worker, (3) Update Web/CLI to poll for job completion, (4) Configure production environments.

---

## 11. Required Changes Classification

### CRITICAL BEFORE PUBLIC LAUNCH
- **Durable Job Processing:** Create `worker.py`, implement Postgres `SKIP LOCKED` queue, refactor API to return 202, update Web/CLI to poll.
- **Public CLI Packaging:** Isolate `recon_cli` in `pyproject.toml` and configure the production API URL default.
- **Upload Size Limits:** Add a 50MB file limit to the API to prevent server crashes.
- **File Storage Shift:** The API must stream uploaded CSVs to Supabase Storage, passing the Storage URL/Path to the `recon_runs` table so the worker can download it (since the worker doesn't share memory/disk with the API).

### IMPORTANT BEFORE PUBLIC LAUNCH
- **CORS Configuration:** Move to `CORS_ORIGINS` env var.
- **FastAPI Threadpool Optimization:** Convert `async def` routes to `def` routes to allow `supabase-py` to run concurrently in threads.

### POST-LAUNCH
- **Advanced Rate Limiting:** Request-per-second throttling.
- **Webhooks:** Pushing job completion to external URLs.
- **Stripe Billing:** Automatic quota and tier assignment.
