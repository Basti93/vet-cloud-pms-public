# Codebase Structure

The project is a Turborepo monorepo with two Next.js applications (`apps/web` and `apps/admin`) sharing a common database schema and tRPC contract through a layered directory structure.

## Requirements

### Requirement: Monorepo Layout
The repository SHALL use Turborepo as the monorepo tool. The `apps/web` directory MUST contain the main customer-facing Next.js application. The `apps/admin` directory MUST contain the internal admin dashboard. Shared code SHALL live under `packages/`.

#### Scenario: Running the web app
- **WHEN** `npm run dev` is executed from `apps/web`
- **THEN** the Next.js dev server starts for the main application only, not the admin app

### Requirement: Next.js App Router Page Structure
All pages in `apps/web` SHALL use the Next.js App Router. Public routes (landing page, online booking, email confirmation) MUST be accessible without authentication. Dashboard routes MUST require an active Clerk session and an active tenant.

#### Scenario: Unauthenticated access to dashboard
- **WHEN** a user without a Clerk session visits `/dashboard`
- **THEN** they are redirected to the sign-in page

#### Scenario: Public booking page
- **WHEN** a visitor navigates to `/book/[tenantSlug]`
- **THEN** the page loads without requiring authentication

### Requirement: tRPC Router Organisation
All API logic SHALL be implemented as tRPC procedures in `apps/web/src/server/routers/`. Each domain MUST have its own router file. All domain routers MUST be combined in `routers/_app.ts`.

#### Scenario: Adding a new domain
- **WHEN** a new domain router is created (e.g. `routers/treatments.ts`)
- **THEN** it is imported and merged into `routers/_app.ts` before any client can call it

### Requirement: Procedure Type Hierarchy
Four procedure types SHALL be used, each composing the correct middleware chain in order: `systemLoggingMiddleware → rateLimitMiddleware → enforceUserIsAuthenticated → enforceTenantIsActive → enforceTenantOwnership`.

- `publicProcedure` — no auth, 100 req/60s rate limit
- `publicBookingProcedure` — no auth, 20 req/60s rate limit (stricter, IP-based)
- `protectedProcedure` — requires Clerk session + active tenant; injects `ctx.tenantId` and `ctx.dbUserId`
- `tenantProcedure` — extends `protectedProcedure`; additionally validates `input.tenantId === ctx.tenantId`
- `adminProcedure` — requires membership in `ADMIN_CLERK_IDS`; uses `adminDb` to bypass future RLS policies

#### Scenario: Tenant ownership check
- **WHEN** a `tenantProcedure` receives a request where `input.tenantId` differs from the authenticated user's tenant
- **THEN** the request is rejected with `FORBIDDEN` and a `tenant_ownership_violation` security event is logged

#### Scenario: Inactive user access
- **WHEN** a user whose `active` flag is `false` calls any procedure not in `INACTIVE_USER_ALLOWED_PATHS`
- **THEN** the request is rejected with `FORBIDDEN` and message `USER_INACTIVE`

#### Scenario: Deactivated tenant access
- **WHEN** a user's tenant is deactivated or scheduled for deletion and they call a procedure not in `DEACTIVATION_ALLOWED_PATHS`
- **THEN** the request is rejected with `FORBIDDEN` and message `TENANT_DEACTIVATED`

### Requirement: Database Schema as Single Source of Truth
All table definitions SHALL live in `apps/web/src/lib/db/schema.ts`. Every table MUST include `tenant_id`, `created_at`, and `updated_at` columns. Tables representing deletable entities MUST include a `deleted_at` soft-delete column.

#### Scenario: Schema change
- **WHEN** a developer modifies `schema.ts`
- **THEN** they run `npm run db:generate` to produce a Drizzle migration file, which is committed alongside the schema change

### Requirement: Lazy Database Client
The database client in `apps/web/src/lib/db/client.ts` SHALL be implemented as a lazy proxy so that `DATABASE_URL` is not evaluated at module load time. This ensures the module can be imported during build without a live database.

#### Scenario: Build-time import
- **WHEN** Next.js builds the application without `DATABASE_URL` set
- **THEN** importing `db` does not throw; the error only surfaces at query execution time

### Requirement: Permission System (RBAC with 3-Layer Cache)
Role-based access control SHALL be implemented in `apps/web/src/lib/auth/`. Permission checks MUST use a three-layer cache: a role-level cache persisting across requests, an in-request deduplication cache, and a synchronous check function. Sensitive procedures MUST call `ctx.session.hasPermission()` before executing.

#### Scenario: Permission check within a procedure
- **WHEN** a tRPC procedure calls `ctx.session.hasPermission('MEDICAL_READ')`
- **THEN** the result is returned from the in-request cache if already resolved in this request, or from the role-level cache if the role was previously loaded, without issuing a new DB query

#### Scenario: Role permission change
- **WHEN** an admin changes the permissions assigned to a role
- **THEN** `invalidateRolePermissionCache(roleId)` is called and a `permission_cache_invalidated` event is written to `system_logs`

### Requirement: Admin Application Separation
The `apps/admin` application SHALL be a separate Next.js application accessible only to internal operators identified by `ADMIN_CLERK_IDS`. Admin pages MUST use `adminProcedure` which uses `adminDb` rather than the tenant-scoped `db`.

#### Scenario: Admin procedure context
- **WHEN** an `adminProcedure` executes a database query
- **THEN** it uses `adminDb` which bypasses future Row-Level Security policies, not the tenant-scoped `db`

### Requirement: System Logging
All application events (slow requests, errors, security violations, cache invalidations) SHALL be written to the `system_logs` table. The `logEvent` function (synchronous) MUST be used for errors. `logEventAsync` MUST be used for non-critical events (slow requests, cache events) to avoid blocking the request path.

#### Scenario: Security violation logging
- **WHEN** a cross-tenant access attempt is blocked by `enforceTenantOwnership`
- **THEN** a `tenant_ownership_violation` warn-level event is written to `system_logs` with the attempted `tenantId`, path, and IP address

### Requirement: Clerk Middleware Placement
The Clerk authentication middleware SHALL live in `apps/web/src/proxy.ts` (not `middleware.ts`, which was deprecated in Next.js 16.2).

#### Scenario: Request entering the app
- **WHEN** any HTTP request arrives at the Next.js app
- **THEN** `proxy.ts` runs first and attaches the Clerk session to the request context before any route handler executes

### Requirement: RAG Semantic Search Tooling
A local RAG index SHALL be maintained in `scripts/dev-rag/` and exposed via the MCP server at `mcp-servers/rag-server.ts`. The index MUST support semantic search via `rag.search(query)` and targeted file reading via `rag.open(path, lineStart)`.

#### Scenario: Semantic code search
- **WHEN** `rag.search("permission cache")` is invoked through the MCP server
- **THEN** the server returns ranked results from the vector index pointing to the relevant files and line ranges
