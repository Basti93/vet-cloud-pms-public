/**
 * SPEC 02 — Migrate callers to existing tenantProcedure
 *
 * tenantProcedure already exists in trpc.ts and runs:
 *   enforceUserIsAuthenticated → enforceTenantIsActive → enforceTenantOwnership
 *
 * enforceTenantOwnership checks input.tenantId === ctx.tenantId, logs the
 * violation as a security event, and throws FORBIDDEN. It is the correct seam.
 *
 * The problem: 18 procedures use protectedProcedure and then re-implement the
 * ownership check manually (DB fetch + compare + throw). They should use
 * tenantProcedure instead and drop the manual check entirely.
 *
 * AFFECTED PROCEDURES
 *
 *   apps/web/src/server/routers/email.ts
 *     getSettings       line ~23  — protectedProcedure + manual check lines 28-35
 *     updateSettings    line ~75  — protectedProcedure + manual check lines 90-97
 *     sendTestEmail     line ~132 — protectedProcedure + manual check lines 147-150
 *
 *   apps/web/src/server/routers/admin.ts   (non-adminProcedure paths only)
 *     ~14 procedures that accept input.tenantId and run the manual check pattern
 *
 *   apps/web/src/server/routers/tenant.ts
 *     1 procedure at line ~695
 *
 * MIGRATION — each affected procedure:
 *
 *   // before
 *   someRoute: protectedProcedure
 *     .input(z.object({ tenantId: z.string().uuid(), ... }))
 *     .query(async ({ ctx, input }) => {
 *       const [user] = await ctx.db
 *         .select({ tenantId: users.tenantId })
 *         .from(users)
 *         .where(eq(users.clerkId, ctx.userId!))
 *         .limit(1);
 *       if (user?.tenantId !== input.tenantId) {
 *         throw new TRPCError({ code: 'FORBIDDEN' });
 *       }
 *       // ... actual logic ...
 *     })
 *
 *   // after
 *   someRoute: tenantProcedure
 *     .input(z.object({ tenantId: z.string().uuid(), ... }))
 *     .query(async ({ ctx, input }) => {
 *       // ctx.tenantId is already verified === input.tenantId by middleware
 *       // ... actual logic (no manual check needed) ...
 *     })
 *
 * CONTEXT SHAPE after tenantProcedure middleware runs:
 *   ctx.tenantId   — string (verified tenant)
 *   ctx.dbUserId   — string (DB users.id for the caller)
 *   ctx.userId     — string (Clerk user ID)
 *
 * VERIFICATION
 *   rtk tsc  → zero new errors
 *   grep -n "user?.tenantId !== input.tenantId" apps/web/src/server/routers/*.ts → no matches
 *   grep -n "currentUser?.tenantId !== input.tenantId" apps/web/src/server/routers/*.ts → no matches
 *
 * EFFORT: ~1.5h (read each procedure carefully — some manual checks are subtly different)
 * RISK: medium — security-critical; verify each removal individually
 * NOTE: admin.ts procedures using adminProcedure are exempt — they bypass tenantId checks by design
 */

export {};
