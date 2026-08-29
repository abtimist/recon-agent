# Recon Agent — Phase 3: API Authentication Report

## Overview
Phase 3 establishes a secure Personal Access Token (PAT) authentication system for the Recon Agent API. This allows the backend to support both browser-based interactive sessions (via Clerk JWTs) and programmatic access (via CLI and scripts) seamlessly, without duplicating API routes or core logic.

## Key Accomplishments

### 1. Database & Token Storage
- Created the `api_tokens` table via migration `004_api_tokens.sql`.
- Tokens are assigned to specific organizations (`org_id`).
- For security, only the `SHA-256` hash of the generated token is stored in the database.
- Added a `scopes` column to enable granular permission sets (currently defaulting to `reconcile`, `history`, `export`, `read`, `write`).
- Added robust Row-Level Security (RLS) policies so a user can only view or revoke tokens associated with their active organization.

### 2. Unified Identity Resolution
- Renamed the base `CurrentUser` model to `CurrentIdentity`, which now includes `is_pat` and `scopes` properties.
- Implemented `get_api_identity()` dependency in `api/auth.py`:
  - **No Ambiguity:** If an Authorization token starts with `ra_live_`, it is deterministically handled as a PAT. If validation fails, it instantly returns a 401 (it does not fall back to Clerk validation).
  - Both PATs and JWTs resolve into identical `CurrentIdentity` structures.
- Updated all core operational routes (`reconcile.py`, `history.py`, `explain.py`, `mappings.py`, `reports.py`) to depend on `get_api_identity` instead of `get_current_user`.

### 3. API Token Management
- Implemented a new router in `api/routes/tokens.py` to handle PAT lifecycle (`POST /api-tokens`, `GET /api-tokens`, `DELETE /api-tokens/{token_id}`).
- The raw token (`ra_live_...`) is generated using 32 bytes of secure entropy and is returned to the client exactly *once* upon creation.
- Deleting a token performs a "soft delete" by setting `revoked_at`, keeping historical context while invalidating future use.

### 4. UI Integration
- Added a "Personal Access Tokens" management section to the settings page (`web/app/(dashboard)/settings/page.tsx`).
- Users can view active and revoked tokens, generate new tokens, and securely copy the token before it disappears.

### 5. Security & Testing Verification
- Developed a comprehensive automated test suite (`tests/test_api_auth.py`).
- Validated prefix-based routing logic (malformed PAT correctly throws 401).
- **Cross-Organization Isolation**: Explicitly simulated an endpoint hit using an Org A identity attempting to fetch an Org B history run. Verified that it correctly results in a `404 Not Found` (filtering out the unauthorized row), ensuring strictly partitioned data access.

## Next Steps
The API is now fully capable of authenticating non-browser clients securely. We are now ready to proceed to **Phase 4: CLI Implementation**, which will utilize these Personal Access Tokens to execute reconciliations directly from the terminal.
