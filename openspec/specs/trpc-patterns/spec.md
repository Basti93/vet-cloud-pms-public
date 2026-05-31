## tRPC Patterns

### RouterPath type convention

`server/trpc.ts` exports a `AppRouterPath` type derived from `AppRouter` via a recursive `RouterPath<T>` helper. This type is a union of every procedure path string in the router tree (e.g. `"tenant.getDeletionStatus"`, `"subscriptions.cancelSubscription"`).

**Use `AppRouterPath` whenever a hardcoded procedure path string must stay in sync with the router.**

Current uses:
- `DEACTIVATION_ALLOWED_PATHS` — procedures accessible while a tenant is deactivated
- `INACTIVE_USER_ALLOWED_PATHS` — procedures accessible to inactive users

**Adding a new path to an allowlist:** add the string literal to the Set initializer. TypeScript errors at build time if the path does not exist in `AppRouter`.

**Renaming a procedure:** TypeScript errors at every allowlist that references the old name.

### Middleware ordering

For tenant-scoped procedures, middleware runs in this order:

1. `enforceUserIsAuthenticated` — Clerk userId present
2. `enforceTenantIsActive` — user has a tenant, tenant not deactivated/deleted, sets `ctx.tenantId`
3. `enforceTenantOwnership` — `input.tenantId` (if present) matches `ctx.tenantId`
4. `requirePermission(perm)` — user's roles include the required permission

### Procedure builders

| Builder | Middleware chain |
|---------|----------------|
| `publicProcedure` | rate limit only |
| `protectedProcedure` | authenticated |
| `tenantProcedure` | authenticated + tenant active + ownership check |
| `adminProcedure` | authenticated + Clerk admin ID allowlist |
