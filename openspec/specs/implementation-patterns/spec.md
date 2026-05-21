# Implementation Patterns

Coding conventions, naming standards, and architectural patterns that ALL tRPC procedures, database queries, React components, and error handling in Vet Cloud PMS MUST follow for consistent, safe, multi-tenant implementation.

## Requirements

### Requirement: tRPC Procedure Structure
Every tRPC procedure SHALL use the appropriate procedure type (`protectedProcedure`, `tenantProcedure`, `publicProcedure`, `publicBookingProcedure`, or `adminProcedure`). Mutations MUST check permissions before any database operation. All inputs MUST be validated with a Zod schema.

#### Scenario: Permission check before mutation
- **WHEN** a mutation procedure executes
- **THEN** `ctx.session.hasPermission()` is called before any database write, and a `TRPCError` with code `FORBIDDEN` is thrown if the check fails

#### Scenario: Zod input validation
- **WHEN** a procedure receives input
- **THEN** the input is validated against an explicit Zod schema with constraints (min/max lengths, enum values, uuid formats) before the handler body runs

#### Scenario: Soft delete
- **WHEN** a delete mutation runs
- **THEN** the record is updated with `deletedAt: new Date()` rather than physically removed from the database

### Requirement: Multi-Tenant Query Filtering
Every database query MUST filter by `tenantId` sourced from `ctx.tenantId` (injected by `enforceTenantIsActive` middleware). Queries MUST also exclude soft-deleted rows by filtering `deletedAt = null` unless explicitly retrieving deleted records.

#### Scenario: Patient list query
- **WHEN** a query fetches rows from any tenant-scoped table
- **THEN** the WHERE clause includes both `eq(table.tenantId, ctx.tenantId)` and `isNull(table.deletedAt)`

#### Scenario: Missing tenant filter
- **WHEN** a query omits the `tenantId` filter
- **THEN** this is treated as a security bug — the query MUST be rejected in code review and corrected before merge

### Requirement: Database Schema Standards
Every new table SHALL include the columns `id` (UUID primary key via `gen_random_uuid()`), `tenantId` (non-null text), `createdAt`, `updatedAt`, and `deletedAt`. Tables MUST use singular snake_case names. An index MUST be created on `tenant_id` and any other frequently-queried column.

#### Scenario: New table definition
- **WHEN** a developer adds a new Drizzle table
- **THEN** the table definition includes `tenantId`, `createdAt`, `updatedAt`, `deletedAt`, and a `tenant_id_idx` index

#### Scenario: SQL injection prevention
- **WHEN** a search query is constructed
- **THEN** Drizzle's parameterized query builder (`like`, `eq`, `ilike`) is used — raw string interpolation into `db.execute()` is never permitted

### Requirement: Error Handling via TRPCError
All errors thrown from tRPC procedures SHALL use `TRPCError` with a semantically correct code (`NOT_FOUND`, `FORBIDDEN`, `BAD_REQUEST`, `INTERNAL_SERVER_ERROR`, `TOO_MANY_REQUESTS`). Internal error details MUST NOT be exposed to the client. Unexpected external errors SHALL be caught, logged via `logEventAsync`, and re-thrown as `INTERNAL_SERVER_ERROR`.

#### Scenario: Resource not found
- **WHEN** a procedure looks up a record that does not exist
- **THEN** a `TRPCError` with code `NOT_FOUND` is thrown with a user-facing message

#### Scenario: External service failure
- **WHEN** a call to an external service throws an unexpected error
- **THEN** the error is caught, logged with `logEventAsync` at level `error`, and re-thrown as `TRPCError` with code `INTERNAL_SERVER_ERROR` — the raw error message is never forwarded to the client

#### Scenario: Forbidden generic Error
- **WHEN** a developer throws `new Error(...)` from a tRPC procedure
- **THEN** this is treated as a bug — tRPC cannot serialize plain errors correctly and they MUST be replaced with `TRPCError`

### Requirement: Async Event Logging
Audit-worthy and operationally important events SHALL be logged via `logEventAsync` (fire-and-forget, non-blocking) or `logEvent` (awaited, for error paths). Every log entry MUST include `level`, `category`, `eventType`, and `metadata`. Routine request traffic MUST NOT be logged to avoid log volume inflation.

#### Scenario: Role assignment logged
- **WHEN** a user's role is changed
- **THEN** `logEventAsync` is called with `category: "admin"`, `eventType: "role_assigned"`, and metadata containing `userId` and `roleId`

#### Scenario: Slow request logged
- **WHEN** a tRPC procedure takes longer than 2000 ms
- **THEN** `systemLoggingMiddleware` writes a `slow_request` warn event to `system_logs` including path and duration

### Requirement: Permission Cache Invalidation
When a role's permissions are changed, the permission cache for that role MUST be invalidated immediately. Cache invalidation SHALL target only the affected role — invalidating the entire cache for a single role change is not permitted.

#### Scenario: Role permission updated
- **WHEN** a role's permission assignment is modified in the database
- **THEN** `invalidateRolePermissionCache(roleId)` is called immediately after the update, and the invalidation is logged with `logEventAsync`

### Requirement: Commit Message Convention
All git commits SHALL use the Conventional Commits format: `<type>: <description>` where type is one of `feat`, `fix`, `docs`, `refactor`, `chore`, or `perf`. The description MUST be imperative, present-tense, and explain the "why" when non-obvious.

#### Scenario: New feature commit
- **WHEN** a developer commits a new feature
- **THEN** the commit message starts with `feat:` followed by a concise description (e.g. `feat: add vaccination reminders`)
