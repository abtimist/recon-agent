# Recon Agent — Platform Integration & CLI Readiness Audit

## 1. Executive Summary

This read-only audit evaluates the integration status of Features 1–7 across the Web, API, and CLI components of the Recon Agent repository. The backend API and frontend Web UI are solidly integrated and share a modern, multi-tenant architecture. However, the existing CLI (`cli.py`) is an entirely disconnected monolithic script that runs reconciliation logic locally instead of utilizing the REST API. 

**Key Finding:** Feature development must pause to stabilize the platform. Git is not initialized, tests are failing on collection, the CLI is not packaged, and API authentication lacks a mechanism for CLI access (e.g., Personal Access Tokens).

---

## 2. Current Architecture

The codebase is organized into distinct layers, but currently suffers from execution-path duplication (API vs CLI).

- **`api/`** (Backend API): FastAPI application exposing REST endpoints for the Web UI. Includes JWT authentication middleware (`auth.py`) and database connection (`db.py`).
- **`web/`** (Frontend): Next.js application handling the user interface, Clerk authentication, and API communication.
- **`core/`** (Engine): Pure Python business logic (`matcher.py`, `duplicate_detector.py`, `ai_resolver.py`, `report_generator.py`).
- **`tests/`** (Testing): Pytest suite for core logic.
- **`api/migrations/`**: SQL scripts for Supabase database schema.
- **`cli.py`**: A standalone, monolithic script using `argparse`. **Flagged:** Operates completely independently of the `api/` layer, causing massive logic duplication and skipping all database persistence.

---

## 3. Feature 1–7 Integration Matrix

| Feature | Core | API | Web | History | Batch | CLI | DB | Tests | Status |
|---------|------|-----|-----|---------|-------|-----|----|-------|--------|
| 1. Configurable Matching Rules | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✓ | ✓ | ⚠ partial |
| 2. Duplicate Detection | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✓ | ✓ | ⚠ partial |
| 3. Trend / Summary Dashboard | ✓ | ✓ | ✓ | ✓ | N/A | ✗ | ✓ | ✗ | ⚠ partial |
| 4. Multi-File / Batch Reconciliation| ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✓ | ✗ | ⚠ partial |
| 5. Exportable / Shareable Reports | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | N/A| ✓ | ⚠ partial |
| 6. Reconciliation History | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✓ | ✓ | ⚠ partial |
| 7. CFO Explanation Mode | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ | ✓ | ⚠ partial |

**Discrepancy:** The CLI supports **none** of the historical, batch, or persistent mapping features because it executes local memory-only reconciliation.

---

## 4. AI Usage Audit

AI is utilized in exactly **two** distinct paths:

1. **AI Resolver (`core/ai_resolver.py`)**
   - **Trigger:** When deterministic exact and fuzzy matching cannot resolve a transaction, the remaining pairs are deemed "ambiguous" and sent to AI.
   - **Input Data:** The raw CSV rows of the source transaction and potential target transactions.
   - **Output:** A strict boolean decision (`is_match`) and a `reason`.
   - **Impact:** Directly affects the reconciliation outcome (marks as matched or exception).
   - **Optional:** Yes. If `provider="none"`, this step is skipped and all ambiguous matches become exceptions.

2. **CFO Explanation (`core/explanation_service.py`)**
   - **Trigger:** User clicks "Explain Results" on the dashboard.
   - **Input Data:** Aggregate statistics, duplicate counts, and a capped sample of exception strings (max 15 exceptions or max 20 runs for batch). 
   - **Output:** A JSON payload (`CFOExplanationResponse`) containing a headline, summary, and action items.
   - **Impact:** Presentation only. Never alters the reconciliation truth.

*Note: All data sent to Gemini, Groq, or OpenAI leaves the application and hits external cloud endpoints. Only Ollama retains data locally.*

---

## 5. API Audit

The API is well-structured and isolated by tenants. It is mature enough to become the shared backend for both Web and CLI.

| METHOD | PATH | PURPOSE | AUTH | ORG CHECK | USED BY WEB | USED BY CLI |
|--------|------|---------|------|-----------|-------------|-------------|
| POST   | `/reconcile/` | Single run | JWT | ✓ | ✓ | ✗ |
| POST   | `/reconcile/batch`| Batch run | JWT | ✓ | ✓ | ✗ |
| GET    | `/runs/` | List history | JWT | ✓ | ✓ | ✗ |
| GET    | `/runs/{run_id}` | Fetch single | JWT | ✓ | ✓ | ✗ |
| POST   | `/explain/` | AI Explanation | JWT | ✓ | ✓ | ✗ |
| POST   | `/export/...` | Generate reports | JWT | ✓ | ✓ | ✗ |
| GET/PUT| `/settings/ai` | Manage AI config | JWT | ⚠ User-scoped | ✓ | ✗ |

**Flag:** `/settings/ai` isolates configuration by `clerk_user_id`, not `org_id`. In an organization, different users will have different AI configurations, which is an architectural mismatch for a B2B SaaS.

---

## 6. Authentication & Tenant Isolation

**Current Flow:** Next.js requests a JWT from Clerk -> API receives Bearer token -> `api/auth.py` validates JWT via Clerk's JWKS -> Extracted `org_id` is used in all `.eq("org_id", ...)` queries.

**CLI Readiness:** **BLOCKED.** The CLI currently cannot authenticate. There is no standard OAuth flow for the CLI, and the backend lacks a Personal Access Token (PAT) system to allow machine-to-machine API access.

---

## 7. Roles / Admin / Permissions

- **Status:** Non-existent in application logic.
- Clerk injects `org_role` into the JWT, and it is passed to the database, but **no feature gates or permission checks** are actually enforced in the FastAPI routes.
- **Recommendation:** Implement a dependency in FastAPI (e.g., `RequireRole("admin")`) before modifying the CLI.

---

## 8. Subscription / Tier Readiness

- **Status:** Missing.
- There are no tables for `plans`, `quotas`, or `entitlements`.
- **Proposed Architecture:**
  - `organizations` table gains `plan_id`.
  - `plans` table defines limits (`max_batch_size`, `can_export_pdf`, `can_use_ai`).
  - Middleware enforces quotas before executing `core/` logic.

---

## 9. CLI Readiness

- **Status:** Legacy/Proof of Concept.
- **Architecture:** The current `cli.py` is a monolithic `argparse` script that imports `core/` directly. It does not hit the API, does not save history to the DB, and does not require login.
- **Proposed Architecture:** 
  - Switch to **Click** or **Typer**.
  - Restructure into a `recon_cli/` package.
  - Implement `recon login` which provisions a PAT.
  - CLI commands (`recon reconcile`, `recon history`) must make HTTP requests to the FastAPI backend, exactly like the Web UI does.

---

## 10. CLI Installation & Distribution

- **Status:** Not packaged.
- There is no `pyproject.toml` configuration defining a `[project.scripts]` entry point. Users currently have to git clone the repo to run it.
- **Fix:** Create a proper `pyproject.toml` so the CLI can be installed globally via `pip install recon-agent` or `uv tool install recon-agent`.

---

## 11. Web/API/CLI Feature Parity

| Capability | Core | API | Web | CLI | Permissions | Tests | Docs |
|------------|------|-----|-----|-----|-------------|-------|------|
| Single Recon | ✓ | ✓ | ✓ | ✗ | ✗ | ⚠ | ⚠ |
| Batch Recon  | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| History View | ✓ | ✓ | ✓ | ✗ | ✗ | ✓ | ✗ |
| AI Explain   | ✓ | ✓ | ✓ | ✗ | ✗ | ✓ | ✗ |

---

## 12. Database & Migration Audit

- Schema and application logic generally align.
- Migrations exist in `api/migrations/`.
- **Risk:** `user_ai_config` table binds to `clerk_user_id`. It should be migrated to `org_ai_config` bound to `org_id` to ensure consistent AI matching behavior for all members of a company.

---

## 13. Dependency & Environment Audit

- Uses `requirements.txt`.
- Relies on `uv` but lacks a formal `pyproject.toml` to manage the project itself as a package.
- Needs dependencies like `typer`, `rich` (for terminal UI), and `keyring` (for secure token storage) before CLI development begins.

---

## 14. Testing Audit

| Test Area | Existing Coverage | Missing Coverage | Risk |
|-----------|-------------------|------------------|------|
| Core Logic| High (Duplicate/AI) | DB persistence | LOW |
| Backend API | None | All routes | HIGH |
| Frontend | None | Component tests | MED |
| System | None | `test_backend.py` fails | HIGH |

**Critical:** `test_backend.py` throws a `KeyError: ['amount', 'date']` on module import/collection. It breaks the entire test suite.

---

## 15. Documentation Audit

- `README.md` exists but is highly outdated. It focuses on the legacy `python cli.py` usage and does not document the API, environment variables, or multi-tenant web functionality.

---

## 16. Code Quality & Integration Findings

1. **`test_backend.py` is broken:** Executes code at the module level with invalid mock data, causing `pytest` to abort collection entirely.
2. **CLI Monolith:** `cli.py` completely duplicates the orchestration logic found in `api/routes/reconcile.py`.
3. **AI Config Tenant Mismatch:** AI settings are saved per-user, not per-org.

---

## 17. Terminal / Development Environment Status

- **CRITICAL:** **Git is not initialized.** (`fatal: not a git repository`). The entire project is currently untracked on the local filesystem.
- Backend and Frontend are running properly in background tasks.
- Virtual environment is active via `uv`.

---

## 18. Git/GitHub Readiness

- **Status:** **NOT READY.**
- Git is completely uninitialized. There is no branch, no commits, and no history.
- `.gitignore` exists and appears adequate, but must be committed.

---

## 19. Critical Issues

1. **[CRITICAL]** Git is not initialized. No version control exists.
2. **[CRITICAL]** `test_backend.py` breaks the test runner on collection.
3. **[HIGH]** CLI operates totally independently of the API, skipping all DB/auth logic.
4. **[HIGH]** API lacks a Personal Access Token (PAT) auth method for the CLI.
5. **[MEDIUM]** AI settings are scoped to the user, not the organization.

---

## 20. Recommended Fix Order

1. **PHASE 2 (Foundations):** Initialize Git, commit existing code, fix `test_backend.py`, migrate `user_ai_config` to `org_ai_config`, and create a proper `pyproject.toml`.
2. **PHASE 3 (API Authentication):** Implement Personal Access Tokens (PATs) in the API to allow machine-to-machine authentication.
3. **PHASE 4 (CLI Re-architecture):** Delete `cli.py`. Build a new `recon_cli/` using Typer that consumes the REST API.
4. **PHASE 5 (Roles & Tiers):** Implement RBAC and subscription limits in the database and API middleware.
5. **PHASE 6 (Testing & Docs):** Write API integration tests and update the README.
6. **PHASE 7 (Feature 8):** Resume net-new feature development.
