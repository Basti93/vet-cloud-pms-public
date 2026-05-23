# Tenant Procedure Migration

`tenantProcedure` already exists in `trpc.ts` and runs the full ownership chain:
`enforceUserIsAuthenticated → enforceTenantIsActive → enforceTenantOwnership`

`enforceTenantOwnership` validates `input.tenantId === ctx.tenantId`, logs violations as
`tenant_ownership_violation` security events, and throws `FORBIDDEN`.

**The problem:** 18 procedures use `protectedProcedure` and then re-implement ownership manually
(DB fetch + compare + throw). Each manual implementation is a gap: inconsistent error logging,
duplicate DB round-trips, and a missed check on any new procedure.

## Requirements

### Requirement: No manual tenant ownership checks in tRPC procedures
Any tRPC procedure that accepts `input.tenantId` SHALL use `tenantProcedure` and rely on
`enforceTenantOwnership` middleware. Manual DB-fetch-and-compare patterns are prohibited.

#### Scenario: Procedure with tenantId input uses tenantProcedure
- **WHEN** a tRPC procedure accepts a `tenantId: z.string().uuid()` field in its input schema
- **THEN** the procedure is declared with `tenantProcedure` (not `protectedProcedure`)
- **AND** there is no inline `if (user?.tenantId !== input.tenantId) throw new TRPCError(...)` block

#### Scenario: Cross-tenant request is rejected and logged
- **WHEN** an authenticated user sends `input.tenantId` that does not match their own tenant
- **THEN** the request is rejected with `FORBIDDEN`
- **AND** a `tenant_ownership_violation` warning is written to `system_logs` with `path`, `tenantId`, and `attemptedTenantId`

#### Scenario: ctx carries resolved tenant after middleware
- **WHEN** a procedure using `tenantProcedure` executes its handler
- **THEN** `ctx.tenantId` is a non-null string equal to `input.tenantId`
- **AND** `ctx.dbUserId` is the `users.id` of the authenticated caller

## Affected Procedures

### `apps/web/src/server/routers/email.ts`
- `getSettings` — switch to `tenantProcedure`, remove manual check lines ~28–35
- `updateSettings` — switch to `tenantProcedure`, remove manual check lines ~90–97
- `sendTestEmail` — switch to `tenantProcedure`, remove manual check lines ~147–150

### `apps/web/src/server/routers/tenant.ts`
- 1 procedure at line ~695 with `user.tenantId !== input.tenantId` pattern

### `apps/web/src/server/routers/admin.ts` (non-adminProcedure paths only)
- ~14 procedures accepting `input.tenantId` with `currentUser?.tenantId !== input.tenantId` pattern
- **Note:** Procedures using `adminProcedure` bypass tenant scoping by design — do not change those

## Migration Pattern

```typescript
// before
someRoute: protectedProcedure
  .input(z.object({ tenantId: z.string().uuid(), ... }))
  .query(async ({ ctx, input }) => {
    const [user] = await ctx.db
      .select({ tenantId: users.tenantId })
      .from(users)
      .where(eq(users.clerkId, ctx.userId!))
      .limit(1);
    if (user?.tenantId !== input.tenantId) {
      throw new TRPCError({ code: 'FORBIDDEN' });
    }
    // ... logic ...
  })

// after
someRoute: tenantProcedure
  .input(z.object({ tenantId: z.string().uuid(), ... }))
  .query(async ({ ctx, input }) => {
    // ctx.tenantId === input.tenantId is guaranteed by middleware
    // ctx.dbUserId is available — no extra DB lookup needed
    // ... logic ...
  })
```

## Verification

```bash
rtk tsc
grep -rn "user?.tenantId !== input.tenantId" apps/web/src/server/routers/
grep -rn "currentUser?.tenantId !== input.tenantId" apps/web/src/server/routers/
# both should return 0 matches
```

## Effort / Risk
- Effort: ~1.5h
- Risk: **medium** — security-critical; verify each removal individually before committing
- Strategy: one router per commit, typecheck between each
