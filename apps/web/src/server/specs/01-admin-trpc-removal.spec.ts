/**
 * SPEC 01 — Delete adminTrpc.ts (shallow wrapper)
 *
 * Deletion test result: complexity vanishes. File re-exports two names with
 * aliases and adds no behaviour. Remove it; callers import directly from trpc.ts.
 *
 * FILES TO DELETE
 *   apps/web/src/server/adminTrpc.ts
 *
 * FILES TO UPDATE (7 routers)
 *   apps/web/src/server/routers/admin-audit.ts
 *   apps/web/src/server/routers/admin-contact-requests.ts
 *   apps/web/src/server/routers/admin-core.ts
 *   apps/web/src/server/routers/admin-logs.ts
 *   apps/web/src/server/routers/admin-reminders.ts
 *   apps/web/src/server/routers/admin-users.ts
 *   apps/web/src/server/routers/admin-vaccinations.ts
 *
 * MIGRATION — each router replaces:
 *
 *   // before
 *   import { createAdminRouter, procedure } from "../adminTrpc";
 *
 *   // after
 *   import { createTRPCRouter, adminProcedure as procedure } from "../trpc";
 *   // rename: createAdminRouter → createTRPCRouter (identical function)
 *
 * VERIFICATION
 *   rtk tsc  → zero new errors
 *   grep -r adminTrpc apps/  → no matches
 *
 * EFFORT: ~15 min
 * RISK: none — pure rename, no behaviour change
 */

export {}; // keep TypeScript happy — no runtime code in this spec
