# audit-middleware Specification

## Purpose
TBD - created by archiving change implementation-cleanup-slices. Update Purpose after archive.
## Requirements
### Requirement: Audited mutations use procedure composition
Mutations that modify selected domain data SHALL guarantee audit log writes through procedure composition rather than ad-hoc handler-body calls.

#### Scenario: Audited mutation succeeds
- **WHEN** a handler built with `auditedMutation` or `auditedProtectedMutation` completes successfully
- **THEN** `writeAuditLog()` is called with the configured action, entity, event, summary, and changes

#### Scenario: Audit write fails
- **WHEN** `writeAuditLog()` throws after the handler succeeds
- **THEN** the mutation response fails instead of silently swallowing the audit error

#### Scenario: Target routers have no direct audit calls
- **WHEN** `medical.ts`, `schedule.ts`, and `admin.ts` are inspected
- **THEN** their mutation handler bodies contain no standalone `await writeAuditLog(ctx, ...)` calls

### Requirement: Audit actor fields come from context
The audit envelope SHALL derive `tenantId`, `dbUserId`, and `clerkUserId` from resolved tRPC context where possible rather than from caller-supplied actor fields.

#### Scenario: Audit envelope actor
- **WHEN** an audited mutation writes an audit row
- **THEN** `changes.actor.clerkUserId` matches `ctx.userId`
- **AND** `changes.actor.userId` matches `ctx.dbUserId`

