import { z } from "zod";
import { createAdminRouter, procedure } from "../adminTrpc";
import { db } from "@/lib/db/client";
import { tenants, users } from "@/lib/db/schema";
import { eq, like, desc, and, count } from "drizzle-orm";

export const adminCoreRouter = createAdminRouter({
  /**
   * List all tenants with optional filters
   */
  listTenants: procedure
    .input(
      z.object({
        search: z.string().optional(),
        plan: z.enum(["free", "starter", "pro", "enterprise"]).optional(),
        status: z.enum(["trial", "active", "paused", "cancelled"]).optional(),
        limit: z.number().default(50),
        cursor: z.string().optional(),
      })
    )
    .query(async ({ input }) => {
      const query = db.select({
        id: tenants.id,
        name: tenants.name,
        slug: tenants.slug,
        plan: tenants.subscriptionPlan,
        status: tenants.subscriptionStatus,
        email: tenants.email,
        createdAt: tenants.createdAt,
      }).from(tenants);

      // Add filters
      const conditions = [];
      if (input.search) {
        conditions.push(like(tenants.name, `%${input.search}%`));
      }
      if (input.plan) {
        conditions.push(eq(tenants.subscriptionPlan, input.plan));
      }
      if (input.status) {
        conditions.push(eq(tenants.subscriptionStatus, input.status));
      }

      if (conditions.length > 0) {
        query.where(and(...conditions));
      }

      // Get user count per tenant
      const result = await query.orderBy(desc(tenants.createdAt)).limit(input.limit + 1);

      const items = result.slice(0, input.limit);
      const nextCursor = result.length > input.limit ? result[input.limit].id : null;

      // Get user counts
      const tenantsWithCounts = await Promise.all(
        items.map(async (tenant) => {
          const [result] = await db
            .select({ count: count(users.id) })
            .from(users)
            .where(eq(users.tenantId, tenant.id));
          return { ...tenant, userCount: result?.count ?? 0 };
        })
      );

      return {
        items: tenantsWithCounts,
        nextCursor,
      };
    }),

  /**
   * Get detailed tenant info including usage stats
   */
  getTenantDetails: procedure
    .input(z.object({ tenantId: z.string().uuid() }))
    .query(async ({ input }) => {
      const [tenant] = await db
        .select()
        .from(tenants)
        .where(eq(tenants.id, input.tenantId));

      if (!tenant) {
        throw new Error("Tenant not found");
      }

      // Get user count
      const [userCountResult] = await db
        .select({ count: count(users.id) })
        .from(users)
        .where(eq(users.tenantId, tenant.id));

      return {
        ...tenant,
        userCount: userCountResult?.count ?? 0,
      };
    }),

  /**
   * Suspend a tenant (prevent access)
   */
  suspendTenant: procedure
    .input(
      z.object({
        tenantId: z.string().uuid(),
        reason: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      await db
        .update(tenants)
        .set({ subscriptionStatus: "paused" })
        .where(eq(tenants.id, input.tenantId));

      return { success: true };
    }),

  /**
   * Unsuspend a tenant
   */
  unsuspendTenant: procedure
    .input(z.object({ tenantId: z.string().uuid() }))
    .mutation(async ({ input }) => {
      await db
        .update(tenants)
        .set({ subscriptionStatus: "active" })
        .where(eq(tenants.id, input.tenantId));

      return { success: true };
    }),

  /**
   * Update tenant plan
   */
  updatePlan: procedure
    .input(
      z.object({
        tenantId: z.string().uuid(),
        plan: z.enum(["free", "starter", "pro", "enterprise"]),
      })
    )
    .mutation(async ({ input }) => {
      await db
        .update(tenants)
        .set({ subscriptionPlan: input.plan })
        .where(eq(tenants.id, input.tenantId));

      return { success: true };
    }),

  /**
   * Toggle feature flag (e.g., AI voice enabled/disabled)
   * For now, stored in a JSON column. Future: dedicated feature_flags table.
   */
  toggleFeatureFlag: procedure
    .input(
      z.object({
        tenantId: z.string().uuid(),
        feature: z.string(), // e.g., "ai_voice", "sms_notifications"
        enabled: z.boolean(),
      })
    )
    .mutation(async ({ input: _input }) => {
      // Placeholder: update to add feature_flags JSONB column later
      // For MVP, just acknowledge the request
      return { success: true };
    }),
});
