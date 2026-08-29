# Phase 5 — Feature 8 Architectural Audit

## 1. Current Architecture
The repository successfully adheres to the `Web / CLI → FastAPI API → Core Engine → Database` architecture.
The API is the absolute single source of truth. Both the Next.js Web frontend and the Typer-based CLI consume the exact same endpoints.
Tenant isolation is strictly enforced at the database level (Row-Level Security) and at the application layer via `get_api_identity()`, which accurately resolves both Clerk JWTs and PATs into a unified `CurrentIdentity` containing `org_id`.

## 2. Current Feature 1–7 Status
**Complete and Integrated.** Configurable matching, duplicate detection, history, batching, export, and AI CFO explanations are completely integrated across the Core, Database, API, Web, and CLI layers. 

## 3. Current Feature 8 Status
**Not Started.** No advanced logic beyond Feature 7 has been committed.

## 4. Exact Definition of Feature 8
Based on the repository state and the specific requirements of this audit, **Feature 8** is defined as the **Enterprise RBAC, Tiering, and Quota System**. 
Before adding advanced Core engine capabilities (like Automated Learning or Advanced Orchestration), the platform *must* have a mechanism to monetize, restrict, and gate these capabilities. Therefore, Feature 8 must implement role-based access control (admin vs member), plan tiers (Free, Pro, Enterprise), PAT scope restrictions, and usage quotas.

## 5. Dependencies Required Before Implementation
- No external libraries are needed, as FastAPI `Depends` and Supabase Postgres are already present.
- Architectural prerequisite: We need an enforcement layer (middleware or dependencies) in FastAPI that can cleanly reject requests before they hit the Core Engine.

## 6. Current Tier / Plan Architecture
- **State:** Practically non-existent.
- **Audit Findings:** The `organizations` table has a `plan` column defaulting to `'free'` (with expected values `'pro'`, `'enterprise'`). However, this column is **never read or enforced** by any API route or Core logic. Every organization currently has unrestricted access to all features (including expensive AI features) without limits. There is no `usage_tracking` or `quotas` table.

## 7. Current Authorization Architecture
- **State:** Incomplete.
- **Audit Findings:** 
  - **Clerk Roles:** Clerk injects `org_role` into the JWT, and it is parsed into `CurrentIdentity.org_role`. The `organization_members` table also has a `role` column. However, there are **no route guards** in FastAPI checking if a user is an `admin` or a `member`. Any authenticated member can theoretically perform any action.
  - **PAT Scopes:** The CLI uses PATs, and Phase 3 added a `scopes` array to the `api_tokens` table (e.g., `["reconcile", "history"]`). `CurrentIdentity` loads these scopes, but FastAPI routes do **not** check them. A PAT currently has full administrative access to the organization regardless of its scopes.
  - **Web Auth:** Clerk is functioning perfectly for identity verification, but lacks local feature-flag UI logic.

## 8. Admin Access Design Recommendation
To allow a "Super Admin" (e.g., platform owner or support staff) to access features without bypassing tenant isolation, we must **never** disable the `org_id` requirement.
Instead, implement an **Impersonation/Support Context**. A Super Admin should be granted a temporary token or session that explicitly binds them to the target customer's `org_id`. This forces all existing `org_id` filters and RLS policies to continue working normally, guaranteeing data integrity while allowing support staff to view the exact state of the tenant.

## 9. API / Web / CLI Integration Plan
- **API:** Introduce dependencies like `RequiresRole("admin")`, `RequiresTier("pro")`, and `RequiresScope("reconcile")`. Apply these selectively to the endpoints.
- **CLI:** CLI gracefully catches `403 Forbidden` API errors and prints human-readable upgrade/permission warnings instead of tracebacks.
- **Web:** Expose the `plan` and `org_role` via a settings endpoint so the Next.js frontend can hide disabled buttons (e.g., locking the "AI Provider" select behind a "Pro" badge).

## 10. Database Changes Required
1. Add a `usage_logs` or `quotas` table to track the number of reconciliation runs per organization per month.
2. Ensure the `organizations.plan` column syncs reliably with the billing provider (e.g., Stripe) in the future.
3. (Optional) Create a `feature_flags` table if we want custom enterprise entitlements beyond the static `plan` string.

## 11. Security Considerations
- PAT scopes must be strictly validated. If a PAT is created with only the `history` scope, it must be hard-blocked from `POST /reconcile/`.
- A user creating a PAT cannot grant the PAT more permissions than the user themselves possesses.
- Route guards must fail-closed. If a tier check fails to execute, the request should be denied.

## 12. Testing Strategy
- Unit tests mocking `CurrentIdentity` with various combinations of `org_role` and `plan`.
- Integration tests verifying that a `free` tier user hitting an AI endpoint receives a `403`.
- Integration tests verifying PAT scope rejections.

## 13. Documentation Requirements
- Update `docs/api-authentication.md` to define exact PAT scopes.
- Create `docs/tiers-and-roles.md` defining the limitations of Free vs Pro vs Enterprise, and Admin vs Member.

## 14. Risks and Edge Cases
- Blocking a batch reconciliation halfway through because the organization hit its quota limit. Quotas must be checked *before* a long-running batch starts.
- Downgrades: If an org downgrades to Free, what happens to their Pro AI configurations? The API must gracefully ignore them and fall back to defaults rather than crashing.

## 15. Exact Implementation Sequence
1. Implement and test FastAPI dependencies (`RequiresRole`, `RequiresTier`, `RequiresScope`).
2. Decorate existing routes (`/reconcile/`, `/settings/`, `/explain/`, etc.) with appropriate guards.
3. Update `CurrentIdentity` logic to fetch the org's current `plan` directly from the database during resolution if not already cached.
4. Update frontend UI to handle `403` status codes and visually lock Pro features.
5. Update CLI to handle `403` scope/tier errors cleanly.

---

# PHASE 5 READINESS:

**NOT READY**

**Minimum Prerequisites that must be completed first:**
Before implementing any net-new AI/Data features, you must execute the Implementation Sequence listed above (Feature 8: Enterprise RBAC, Tiering, and Quota System). The API currently ignores all scopes, roles, and plan limits, leaving the system completely unprotected against abuse and impossible to monetize. Feature 8 must be the implementation of these gates.
