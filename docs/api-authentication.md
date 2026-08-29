# Recon Agent API Authentication

The Recon Agent API uses a dual-authentication mechanism to support both interactive users (via a browser) and programmatic access (via CLI or custom scripts).

Both methods rely on passing a Bearer token in the `Authorization` HTTP header.

```http
Authorization: Bearer <token>
```

## Supported Token Types

### 1. Clerk JWT (Browser / Frontend)
When accessing the API through the React Next.js frontend, the system uses Clerk authentication.
The client retrieves a temporary JWT from Clerk and sends it to the API.

- **Prefix:** None (standard JWT structure: `header.payload.signature`)
- **Validation:** The API validates the signature against Clerk's public JSON Web Key Set (JWKS).
- **Identity:** The API extracts `clerk_user_id` (`sub`), `org_id`, and `org_role`.

### 2. Personal Access Tokens (CLI / Scripts)
For programmatic access, users can generate Personal Access Tokens (PATs) from the Settings dashboard.
Tokens act on behalf of the user's organization and are intended for long-lived integration.

- **Format:** High-entropy string starting with `ra_live_` (e.g., `ra_live_1a2b3c4d5e...`)
- **Validation:** 
  - If a token starts with `ra_live_`, the API explicitly treats it as a PAT. 
  - It hashes the token using `SHA-256` and looks it up in the `api_tokens` database table.
- **Security:** The database stores *only* the SHA-256 hash. The raw token is shown only once at creation.
- **Identity:** Resolves to the same identity structure as a Clerk JWT (`org_id`, `clerk_user_id`), sets `is_pat=True`, and applies `scopes`. It also inherits the creator's current `org_role` and the organization's current `plan` dynamically at runtime.

## Authentication Resolution Workflow

The FastAPI `get_api_identity()` dependency evaluates incoming requests as follows:

1. **Header Check**: Requires `Authorization: Bearer <token>`.
2. **Type Inference**: 
   - If `token.startswith("ra_live_")`, process as PAT.
   - Else, process as Clerk JWT.
3. **PAT Validation**:
   - Hash token using SHA-256.
   - Lookup in database.
   - Reject if not found, revoked, or mismatched.
   - Update `last_used_at` asynchronously.
4. **JWT Validation**:
   - Download/Cache JWKS from Clerk.
   - Verify RS256 signature and audience.
   - Reject if expired or tampered.
5. **Return**: Both flows return a unified `CurrentIdentity` object.

## Role-Based Access Control and Scopes

- **Clerk JWTs** rely on Clerk's RBAC (`org_role`).
- **PATs** dynamically inherit the current `org_role` of the user who created them (meaning if the user is demoted, their PAT is also demoted).
- **PAT Scopes** provide a secondary limitation mechanism. A PAT may have the `reconcile` and `history` scopes. Scopes can only restrict privileges, they can never elevate a PAT above the creator's `org_role`.
- **Tiers/Quotas** are dynamically checked on every request. Both Web and CLI requests are validated against the organization's `plan` limits.

## Security Measures

- **No Ambiguous Fallback**: A token is definitively typed by its prefix. A malformed PAT never falls back to being checked as a JWT, preventing downgrade or confusion attacks.
- **Strict Cross-Org Isolation**: Tokens are rigidly tied to a single `org_id`. Any query made by a PAT enforces Row Level Security (or application-level Python checks) to guarantee access *only* to data belonging to that `org_id`.
- **Database Exposure**: Raw PATs are never stored. If the database is compromised, the tokens cannot be reverse-engineered.
