# tenant-stats-query Specification

## Purpose
TBD - created by archiving change implementation-cleanup-slices. Update Purpose after archive.
## Requirements
### Requirement: Tenant list with stats avoids N+1 queries
The admin tenant list SHALL retrieve tenants and associated user counts without issuing one count query per tenant.

#### Scenario: List tenant page
- **WHEN** `listTenants` is called with any page size
- **THEN** tenant rows are fetched with a bounded number of SQL queries
- **AND** returned tenants include correct `userCount`, `deletionStatus`, and `deletionScheduledFor` values

#### Scenario: Empty results
- **WHEN** the tenant query returns no tenants
- **THEN** no user-count query is issued for individual tenants

### Requirement: Tenant stats retrieval is a named module
Tenant stats lookup SHALL be encapsulated in a named query module instead of inline `Promise.all(items.map(...))` logic in the router.

#### Scenario: Router delegates stats query
- **WHEN** `apps/web/src/server/routers/admin-core.ts` handles `listTenants`
- **THEN** it delegates to `queryTenantsWithStats`
- **AND** the procedure body contains no inline per-tenant `Promise.all` count loop

