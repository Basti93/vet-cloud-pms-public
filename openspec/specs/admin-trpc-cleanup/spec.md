# admin-trpc-cleanup Specification

## Purpose
TBD - created by archiving change implementation-cleanup-slices. Update Purpose after archive.
## Requirements
### Requirement: No intermediate re-export module for admin routers
Admin routers SHALL import `createTRPCRouter` and `adminProcedure` directly from the shared tRPC module rather than through an intermediate re-export file.

#### Scenario: Admin router imports
- **WHEN** any file in `apps/web/src/server/routers/admin-*.ts` imports tRPC router or procedure primitives
- **THEN** it imports them from `../trpc` or `@/server/trpc`
- **AND** it does not import from `../adminTrpc` or `@/server/adminTrpc`

#### Scenario: adminTrpc module removed
- **WHEN** `apps/web/src/server/adminTrpc.ts` is looked up in the filesystem
- **THEN** the file does not exist

