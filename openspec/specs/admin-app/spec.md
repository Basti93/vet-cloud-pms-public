# Admin Application

## Purpose

The admin app (`apps/admin`) is a separate Next.js application for Vet Cloud PMS system administrators, providing tenant management, user inspection, and audit log access via a tRPC proxy to the main web API.
## Requirements
### Requirement: System Admin Identity Separation
System administrators SHALL be defined exclusively via the `ADMIN_CLERK_IDS` environment variable on the web app and MUST NOT appear in the `users` database table. System admin identity is completely external to the multi-tenant user model.

#### Scenario: System admin accesses the admin dashboard
- **WHEN** a user whose Clerk ID is listed in `ADMIN_CLERK_IDS` signs in to the admin app
- **THEN** they are granted access to all tenant management features without any row in the `users` table being consulted

#### Scenario: Tenant user attempts system admin action
- **WHEN** a Clerk user whose ID is not in `ADMIN_CLERK_IDS` calls an `adminProcedure` endpoint
- **THEN** the request is rejected with `FORBIDDEN` before any database query executes

### Requirement: tRPC Proxy with Namespace Restriction
The admin app SHALL proxy all tRPC calls to the main web app API. The proxy MUST restrict forwarding to procedures prefixed with `adminDashboard.` only. Any request to a procedure outside this namespace MUST be blocked before it reaches the upstream API.

#### Scenario: Admin calls an allowed procedure
- **WHEN** the admin UI calls `adminDashboard.tenants.list`
- **THEN** the proxy forwards the request to `{WEB_API_URL}/api/trpc/adminDashboard.tenants.list` with the original authorization header and a generated `x-request-id`

#### Scenario: Admin calls a non-admin procedure
- **WHEN** the proxy receives a tRPC path that does not start with `adminDashboard.`
- **THEN** it returns HTTP 403 with `{ "error": "Forbidden tRPC procedure" }` without contacting the upstream

#### Scenario: Upstream web API is unavailable
- **WHEN** the upstream fetch to the web app times out (10-second limit) or fails
- **THEN** the proxy returns HTTP 502 with `{ "error": "Upstream admin API unavailable", "requestId": "<uuid>" }`

#### Scenario: Production URL enforcement
- **WHEN** the admin app runs in a `NODE_ENV=production` environment
- **THEN** `WEB_API_URL` MUST use `https:` protocol; an HTTP URL causes the proxy to throw and refuse to start

### Requirement: Self-Proxy Loop Prevention
The proxy MUST detect and abort requests where the computed target host equals the incoming request host, preventing accidental admin-to-admin routing loops.

#### Scenario: Misconfigured WEB_API_URL pointing to itself
- **WHEN** `WEB_API_URL` resolves to the same host as the admin app
- **THEN** the proxy throws an error identifying the loop and does not forward the request

### Requirement: Tenant Management Capabilities
System admins SHALL be able to list all tenants, view per-tenant detail (plan, seat usage, subscription status), and perform mutations (suspend, modify plan) on any tenant.

#### Scenario: Admin views tenant list
- **WHEN** a system admin navigates to `/dashboard/tenants`
- **THEN** all tenants across the system are listed, irrespective of their own tenant membership

#### Scenario: Admin suspends a tenant
- **WHEN** a system admin triggers a suspend action on a tenant
- **THEN** the mutation executes and the action is logged to `system_logs` with `tenantId: null` and the admin's Clerk ID in `metadata.systemAdminId`

### Requirement: Audit Log Querying
System admins SHALL be able to query audit logs across all tenants with filtering by tenant, action type, entity type, and date range. Log entries MUST NOT be mutable or deletable via the admin interface.

#### Scenario: Admin queries logs for a specific tenant
- **WHEN** a system admin filters the audit log view by a tenant ID
- **THEN** only `audit_logs` rows for that tenant are returned, joined with the tenant name

#### Scenario: Admin views audit entry details
- **WHEN** a system admin requests details for a specific audit entry
- **THEN** the full entry including `changes` (JSONB envelope), `ipAddress`, and `userAgent` is returned

#### Scenario: Admin requests audit summary
- **WHEN** a system admin requests a summary for a given time window (1–720 hours)
- **THEN** aggregate counts of `create`, `update`, `delete`, `export` actions, distinct users, and distinct entity types are returned alongside the top-5 action and entity-type breakdowns

### Requirement: All Admin Actions Logged
Every state-mutating action performed by a system admin MUST produce a `system_logs` entry with `tenantId: null`, `userId: null`, and the admin's Clerk ID recorded in `metadata.systemAdminId`.

#### Scenario: Plan update by system admin
- **WHEN** a system admin changes a tenant's subscription plan
- **THEN** a `system_logs` row is written with `action: "config_change"` and `metadata` containing `systemAdminId` and the before/after plan values

### Requirement: System Admin Feedback Triage
System admins SHALL be able to list, inspect, filter, and update user feedback submissions across all tenants from the internal admin application.

#### Scenario: Admin views feedback list
- **WHEN** a system admin navigates to `/dashboard/feedback`
- **THEN** the admin app displays feedback submissions across all tenants sorted by newest first

#### Scenario: Admin filters feedback
- **WHEN** a system admin filters feedback by status, category, tenant, source module, or search text
- **THEN** the admin app displays only feedback submissions matching those filters

#### Scenario: Admin views feedback context
- **WHEN** a system admin opens or scans a feedback submission
- **THEN** the admin app shows the tenant, submitting user, source module, source path, submitted message, status, priority, created timestamp, and browser metadata when available

#### Scenario: Admin updates feedback status
- **WHEN** a system admin changes a feedback submission status
- **THEN** the system persists the new status and records the system admin identity and update timestamp

#### Scenario: Admin action is logged
- **WHEN** a system admin changes feedback status, priority, or triage notes
- **THEN** the system writes a `system_logs` row with `tenantId: null`, `userId: null`, and the admin's Clerk ID in `metadata.systemAdminId`

#### Scenario: Non-admin attempts feedback triage
- **WHEN** a Clerk user whose ID is not listed in `ADMIN_CLERK_IDS` calls an admin feedback procedure
- **THEN** the request is rejected with `FORBIDDEN` before returning any feedback data

