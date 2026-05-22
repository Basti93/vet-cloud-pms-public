# System Architecture

Vet Cloud PMS is a multi-tenant SaaS practice management system for veterinary clinics in DACH, built as a modular monolith on Hetzner Cloud in Frankfurt to ensure DSGVO compliance.

## Requirements

### Requirement: Modular Monolith Deployment
The system SHALL be deployed as a single deployable unit with clean domain boundaries in code. Splitting into separate services is not permitted until the engineering team exceeds six members.

#### Scenario: Single deployable artifact
- **WHEN** a production deployment is triggered
- **THEN** one container image is built and deployed per app (web, admin), not multiple services

### Requirement: Multi-Tenancy via Tenant Isolation
Every database table SHALL include a `tenant_id` column. All queries MUST filter by `tenant_id` belonging to the authenticated user. Cross-tenant data access MUST be blocked at both the application and (future) database layer.

#### Scenario: Patient list query
- **WHEN** a user queries for patients
- **THEN** the query includes `WHERE tenant_id = <authenticated user's tenant>` and no rows from other tenants are returned

#### Scenario: Cross-tenant access attempt
- **WHEN** an authenticated user sends a `tenantId` in the request payload that does not match their own tenant
- **THEN** the request is rejected with `FORBIDDEN` and a `tenant_ownership_violation` security event is logged

### Requirement: DSGVO-Compliant Data Handling
The system SHALL store all patient and clinic data exclusively on infrastructure in Germany (Frankfurt). Audit logs, soft deletes, and data export endpoints MUST be provided before onboarding real clinic data.

#### Scenario: Infrastructure region
- **WHEN** any application or database workload runs
- **THEN** it runs on Hetzner CX22 Frankfurt — no US-region services hold persistent patient data

#### Scenario: Soft delete
- **WHEN** a record is deleted through the application
- **THEN** the record is marked with `deleted_at` and excluded from queries, not physically removed

### Requirement: End-to-End Type Safety
All API interactions MUST go through tRPC v11. TypeScript types MUST be shared between the frontend and backend with no hand-maintained type duplication. The client SHALL never see raw SQL or database schema types.

#### Scenario: New API endpoint
- **WHEN** a new procedure is added to a tRPC router
- **THEN** the input and output types are automatically inferred by the client without any manual type file changes

### Requirement: API-First Interface
All UI interactions SHALL go through a documented tRPC procedure. No direct database calls from client components are permitted.

#### Scenario: Creating an appointment
- **WHEN** a user clicks "Create Appointment" in the UI
- **THEN** the action dispatches a tRPC call (`appointments.create`) that goes through auth and tenant middleware before touching the database

### Requirement: Hetzner/Coolify Deployment
Both staging and production environments SHALL run on Hetzner Cloud Frankfurt via Coolify. Auto-deployment MUST be triggered by git push to the `staging` branch (staging env) or `main` branch (production env).

#### Scenario: Push to main
- **WHEN** a commit is pushed to `main`
- **THEN** Coolify automatically builds and deploys the production web and admin apps at `example.com` and `apps.example.com`

#### Scenario: Push to staging
- **WHEN** a commit is pushed to `staging`
- **THEN** Coolify automatically deploys to `staging.example.com` and `staging.apps.example.com`

### Requirement: Automatic Database Migration on Deploy
Database migrations SHALL run automatically on every container start before the application server begins accepting traffic.

#### Scenario: Container startup
- **WHEN** a new container starts
- **THEN** `entrypoint.sh` runs `migrate.mjs` (Drizzle migrator) and only starts the Next.js server after all pending migrations complete successfully

### Requirement: Rate Limiting
All tRPC procedures MUST enforce rate limiting before reaching procedure logic. Authenticated procedures SHALL allow 100 requests per 60 seconds per user. Public booking procedures SHALL allow 20 requests per 60 seconds per IP.

#### Scenario: Authenticated user exceeds rate limit
- **WHEN** an authenticated user sends more than 100 requests within 60 seconds
- **THEN** subsequent requests receive a `TOO_MANY_REQUESTS` error with the reset timestamp

#### Scenario: Public booking endpoint abuse
- **WHEN** an IP address sends more than 20 requests to a public booking procedure within 60 seconds
- **THEN** subsequent requests receive a `TOO_MANY_REQUESTS` error

### Requirement: Request Logging and Slow Request Detection
The system SHALL log all failed requests and any request exceeding 2000 ms to `system_logs`. Admin-proxied requests MUST NOT be logged to avoid noise.

#### Scenario: Slow request
- **WHEN** a tRPC procedure takes longer than 2000 ms
- **THEN** a `slow_request` warning is written to `system_logs` with path, duration, tenant, and user

#### Scenario: Failed request
- **WHEN** a tRPC procedure throws a `TRPCError`
- **THEN** the error is logged synchronously with code, path, duration, and stack trace before rethrowing

### Requirement: Scheduled Cron Jobs
Recurring jobs SHALL run as HTTP POST endpoints protected by `Authorization: Bearer $CRON_SECRET`, triggered by Coolify's built-in scheduler.

#### Scenario: Appointment reminder cron
- **WHEN** the hourly cron fires at `0 * * * *`
- **THEN** `POST /api/cron/send-reminders` is called with the cron secret and reminder emails are dispatched

#### Scenario: Unauthorized cron call
- **WHEN** a request arrives at a cron endpoint without the correct `CRON_SECRET` bearer token
- **THEN** the endpoint returns 401 and no job logic executes
