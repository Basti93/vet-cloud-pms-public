# adminTrpc.ts Removal

`adminTrpc.ts` is a shallow wrapper that re-exports two names from `trpc.ts` with aliases and adds no behaviour. Deletion test: complexity vanishes entirely. Remove the indirection.

## Requirements

### Requirement: No intermediate re-export module for admin routers
Admin routers SHALL import `createTRPCRouter` and `adminProcedure` directly from `../trpc` rather than through an intermediate re-export file.

#### Scenario: Admin router imports
- **WHEN** any file in `apps/web/src/server/routers/admin-*.ts` is opened
- **THEN** there is no `import ... from "../adminTrpc"` or `import ... from "@/server/adminTrpc"` statement

#### Scenario: adminTrpc.ts does not exist
- **WHEN** `apps/web/src/server/adminTrpc.ts` is looked up in the filesystem
- **THEN** the file does not exist

## Migration

Files to update (replace `createAdminRouter, procedure` import):

| File | Old import | New import |
|------|-----------|------------|
| `routers/admin-audit.ts` | `from "../adminTrpc"` | `from "../trpc"` |
| `routers/admin-contact-requests.ts` | `from "../adminTrpc"` | `from "../trpc"` |
| `routers/admin-core.ts` | `from "../adminTrpc"` | `from "../trpc"` |
| `routers/admin-logs.ts` | `from "../adminTrpc"` | `from "../trpc"` |
| `routers/admin-reminders.ts` | `from "../adminTrpc"` | `from "../trpc"` |
| `routers/admin-users.ts` | `from "../adminTrpc"` | `from "../trpc"` |
| `routers/admin-vaccinations.ts` | `from "@/server/adminTrpc"` | `from "@/server/trpc"` |

Rename at each call site:
- `createAdminRouter` → `createTRPCRouter`
- `procedure` → `adminProcedure` (or keep local alias: `const procedure = adminProcedure`)

## Verification

```bash
rtk tsc                                          # zero new errors
grep -r "adminTrpc" apps/web/src/               # zero matches
```

## Effort / Risk
- Effort: ~15 min
- Risk: none — pure alias rename, no behaviour change
