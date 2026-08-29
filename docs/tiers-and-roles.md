# Recon Agent: Roles, Tiers, and Quotas

Recon Agent uses a multi-tenant Role-Based Access Control (RBAC) and Tiering system designed to restrict access and usage on a per-organization basis.

## Roles
Users in an organization have a specific role that dictates what they can do within the platform.
Roles are managed via Clerk and synchronized to the `organization_members` table.

- **Admin**: Has full access. Can view and modify all resources, generate and revoke Personal Access Tokens (PATs), and configure the organization's AI Provider and Models.
- **Member**: Has standard access. Can upload files, run reconciliation, view history, and export reports. Cannot generate PATs or change AI Settings.

## PAT Scopes
Personal Access Tokens inherit the organization-level role of the user who created them (Admins), but they can be further restricted using Scopes.
- `reconcile`: Allows running reconciliation jobs.
- `history`: Allows viewing the run history and exceptions.
- `export`: Allows exporting PDF and Excel reports.
- `explain`: Allows requesting CFO Explanations.

## Tiers and Quotas
Each organization is assigned a `plan` (Free, Pro, Enterprise) stored in the `organizations` table.
Reconciliation jobs consume quota. Usage is tracked in `organization_usage` by billing period (`YYYY-MM`).

### Tiers
- **Free**: Max 100 runs/month. Max 1 pair per batch. Does not have access to CFO Explanations.
- **Pro**: Max 1,000 runs/month. Max 5 pairs per batch. Includes CFO Explanations.
- **Enterprise**: Max 100,000 runs/month. Max 20 pairs per batch. Includes CFO Explanations.

### Enforcements
- Quota is pre-flight checked before running a batch. If the requested batch size exceeds the remaining monthly limit or the tier's batch limit, the entire batch is rejected with a `429 Too Many Requests` error.
- Tier limitations (like CFO Explanations) are enforced at the API route level with a `403 Forbidden` error.
