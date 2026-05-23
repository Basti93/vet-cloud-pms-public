# tenant-procedure-migration Specification

## Purpose
TBD - created by archiving change implementation-cleanup-slices. Update Purpose after archive.
## Requirements
### Requirement: Tenant-id procedures use shared ownership middleware
Any tRPC procedure that accepts an `input.tenantId` field and is scoped to the authenticated tenant SHALL use `tenantProcedure` and rely on `enforceTenantOwnership`.

#### Scenario: Procedure with tenantId input
- **WHEN** a tenant-scoped tRPC procedure accepts `tenantId: z.string().uuid()`
- **THEN** the procedure is declared with `tenantProcedure`
- **AND** it does not perform a manual current-user tenant comparison in the handler

#### Scenario: Cross-tenant input
- **WHEN** an authenticated tenant user sends an `input.tenantId` that differs from their resolved tenant
- **THEN** the request is rejected with `FORBIDDEN`
- **AND** a `tenant_ownership_violation` event is written to `system_logs`

#### Scenario: Resolved tenant context
- **WHEN** a `tenantProcedure` handler executes
- **THEN** `ctx.tenantId` equals `input.tenantId`
- **AND** `ctx.dbUserId` contains the authenticated database user ID

