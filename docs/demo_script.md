# Recon Agent Demo Script

This script outlines how to walk a technical interviewer through the Recon Agent application, proving its scale, architecture, and security constraints.

## 1. Demonstrate Asynchronous Job Processing

**Goal:** Prove the API doesn't block and that a background worker pattern is implemented.

1. **Upload a 50k Row Dataset:** Navigate to the "New Run" page. Upload a large synthetic dataset (approx 50,000 rows).
2. **Hit "Run":** The UI immediately transitions to a "Processing..." state.
3. **Point out the Network Tab:** Open Chrome DevTools. Show the interviewer that the `POST /reconcile` request returned almost instantly (usually ~200ms) with a `status: queued`.
4. **Explain the Architecture:** Explain that the API inserted a job into the `recon_runs` table and returned. A background `python worker.py` process running separately is actively polling the database using a `SELECT ... FOR UPDATE SKIP LOCKED` query to safely claim and execute the job.

## 2. Demonstrate Engine Performance

**Goal:** Prove the $O(n \log m)$ complexity claims.

1. **Wait for Completion:** After ~45 seconds, the UI will poll and retrieve the completed results.
2. **Review Metrics:** Point out the exact numbers. Explain that doing 50,000 $\times$ 50,000 naive string comparisons would have taken hours, but by utilizing binary search (`numpy.searchsorted`) and numeric vectorization (`numpy.where`) for date and amount filters, the engine radically reduced the candidate pool before running the expensive C++ `rapidfuzz` scoring.

## 3. Demonstrate Security (RLS)

**Goal:** Prove that multi-tenant data is secure at the database level.

1. **Create an API Token:** Navigate to Settings > API Tokens and generate a new token.
2. **Query the API:** Use curl or Postman to hit the `GET /runs` endpoint with the token.
3. **Explain RLS:** Explain that even if you somehow managed to guess another organization's UUID, you could not access their runs. Supabase Row-Level Security checks the `auth.uid()` embedded in the JWT token at the database level. The backend explicitly calls `_ensure_org(db, user)` before passing queries down, acting as a defense-in-depth measure.

## 4. Demonstrate Error Resilience

**Goal:** Prove the worker can survive connection drops.

1. **Stop the Worker:** If demonstrating locally, kill the `worker.py` process mid-execution.
2. **Show the Job Status:** Explain that the job will be picked up again or marked as failed based on the robust exception handling blocks added to the worker script, which catch `psycopg2.OperationalError` for database disconnects.
