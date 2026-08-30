# Architecture of Recon Agent

Recon Agent uses a highly decoupled, asynchronously driven architecture built on top of FastAPI, Supabase, and Python worker processes. It is designed to scale horizontally and survive sudden connection drops.

## Component Flow

1. **Frontend (Vercel)**
   - Built with Next.js and Tailwind.
   - Responsible for presentation and client-side validation.
   - Uploads files directly to Supabase Storage via signed URLs (bypassing the API for large payloads).

2. **API (Render)**
   - Built with FastAPI (`api/main.py`).
   - Acts as a control plane for reading results, managing settings, and inserting jobs into the `recon_runs` table.
   - Uses row-level multi-tenant isolation via Clerk JWTs and API Tokens (`api/auth.py`).
   - DOES NOT perform reconciliation itself to avoid blocking HTTP requests or hitting reverse proxy timeouts.

3. **Background Worker (Dockerized)**
   - Runs as a detached container executing `worker.py`.
   - Uses `BRPOP` (blocking right pop) to instantly consume jobs off an Upstash Redis message queue, completely eliminating database polling overhead and minimizing latency.
   - Downloads files from Supabase Storage, executes the reconciliation pipeline (`core/matcher.py`), generates the result payload, and commits it back to the database.

4. **Message Broker (Redis)**
   - Uses Upstash Redis to decouple API endpoints from the worker processing queue.
   - Provides lightning-fast in-memory job buffering.

5. **Database (Supabase PostgreSQL)**
   - Serves as the source of truth for authentication rules, jobs, and results.
   - Implements Row-Level Security (RLS) to enforce tenant isolation at the database layer.

## Observability

- **Sentry**: Integrated at both the FastAPI and worker layers for comprehensive error tracking. Tracing is enabled with a 100% sample rate, automatically profiling worker execution time to identify computational bottlenecks.

## Reconciliation Engine

The core engine (`core/matcher.py`) performs $O(n \log m)$ matching by:
1. Identifying exact matches via pandas merges.
2. Filtering the remaining unmatched rows using binary search (`np.searchsorted`) based on a sorted date array.
3. Using `numpy.where` to filter the candidate pool by amount tolerance.
4. Finally, scoring only the remaining candidates using `rapidfuzz` (implemented in C++).

This dramatically reduces the number of string comparisons required, scaling to 50,000 rows in ~45 seconds on standard hardware.

## AI Fallback

AI explanation (`core/explanation_service.py`) acts purely as a secondary heuristic to summarize exception reports. It relies on a capped payload of deterministic findings and is decoupled from the core matching logic. The system gracefully degrades if the AI provider fails or returns malformed JSON.
