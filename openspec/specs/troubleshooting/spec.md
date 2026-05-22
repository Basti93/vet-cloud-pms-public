# Troubleshooting

Diagnostic procedures and resolution steps for the most common runtime, permission, performance, and type errors in Vet Cloud PMS.

## Requirements

### Requirement: Permission Error Diagnosis
When a user receives a `FORBIDDEN` error they should not receive, the diagnosis MUST follow a four-step sequence: verify role assignment in admin logs, verify the role has the required permission in `role_permissions`, check for a stale permission cache, and confirm the tRPC procedure calls `ctx.session.hasPermission()`.

#### Scenario: Role missing from user
- **WHEN** a FORBIDDEN error is reported and admin logs show no `role_assigned` event for the user
- **THEN** the admin panel is used to assign the correct role to the user

#### Scenario: Permission cache stale
- **WHEN** a FORBIDDEN error persists after confirming the role and permission are correctly assigned
- **THEN** `invalidateRolePermissionCache(roleId)` is called (or the dev server is restarted) to clear the in-memory cache

#### Scenario: Procedure missing permission check
- **WHEN** diagnosis reveals the tRPC procedure does not call `ctx.session.hasPermission()`
- **THEN** the permission guard is added before any database operation and the fix is deployed

### Requirement: Slow Request Diagnosis
When p95 latency exceeds 200 ms or a specific endpoint consistently takes more than 2000 ms, the investigation MUST use the admin Performance page, the `slow_request` system log entries, local timing instrumentation, schema index inspection, and N+1 query detection.

#### Scenario: N+1 query found
- **WHEN** a slow request investigation reveals a loop of per-row database queries
- **THEN** the queries are consolidated to a single batch query using `inArray` or a JOIN, eliminating the per-iteration round-trip

#### Scenario: Missing index found
- **WHEN** a frequently-queried column has no index
- **THEN** an index is added to `schema.ts`, a Drizzle migration is generated and committed, and deployment is verified

### Requirement: Database Connection Error Resolution
A database connection failure MUST be diagnosed by confirming `DATABASE_URL` exists in `.env.local`, testing the connection with `psql $DATABASE_URL -c "SELECT 1;"`, and verifying network access to the database host.

#### Scenario: Missing DATABASE_URL
- **WHEN** the dev server fails with `ECONNREFUSED` and `.env.local` does not contain `DATABASE_URL`
- **THEN** the developer copies `.env.example` and fills in the correct `postgresql://` connection string

### Requirement: TypeScript and Lint Error Resolution
TypeScript errors and lint violations MUST be resolved before commit. Auto-fixable lint errors SHALL be resolved with `npm run lint -- --fix`. TypeScript errors caused by mismatched tRPC return types SHALL be resolved by adding an explicit return type annotation to the procedure.

#### Scenario: Procedure return type mismatch
- **WHEN** TypeScript reports `Property does not exist on type` on a tRPC query result
- **THEN** the procedure is annotated with an explicit `Promise<T>` return type and the returned value is verified to match the expected shape

#### Scenario: Zod validation mismatch
- **WHEN** a client receives a `validation failed` error when calling a procedure
- **THEN** the actual input shape is logged (`console.log(JSON.stringify(input))`), the Zod schema is inspected, and any type or enum mismatches (e.g. `'Dog'` vs `'dog'`) are corrected on the sending side

### Requirement: Permission Cache Monitoring
The admin dashboard Performance page SHALL be used to monitor permission cache health. A cache hit rate below 50% or zero invalidations after a permission change indicates a problem that MUST be investigated.

#### Scenario: Cache hit rate near zero
- **WHEN** the admin Performance page shows hits = 0
- **THEN** the invalidation logic is reviewed to determine if global invalidation is being called too frequently instead of targeted `invalidateRolePermissionCache(roleId)` calls

### Requirement: CI/CD Failure Resolution
When a CI build fails, the failure MUST be diagnosed from GitHub Actions logs. The resolution order is: fix TypeScript errors (`npm run typecheck`), fix lint errors (`npm run lint -- --fix`), fix build errors (`npm run build`), then fix failing tests (`npm run test`). All checks MUST pass locally before re-pushing.

#### Scenario: Typecheck failure on PR
- **WHEN** `pr-checks.yml` fails due to a TypeScript error
- **THEN** the developer runs `npm run typecheck` locally, reproduces the error, fixes it, and pushes a new commit — the CI run is not re-triggered with `--no-verify`
