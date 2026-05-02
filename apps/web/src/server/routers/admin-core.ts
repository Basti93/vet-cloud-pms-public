import { z } from "zod";
import { createAdminRouter, procedure } from "../adminTrpc";
import { db } from "@/lib/db/client";
import { tenants, users, auditLogs, systemLogs } from "@/lib/db/schema";
import { eq, like, desc, and, count, gte, sql } from "drizzle-orm";
import { writeAuditLog } from "@/server/audit";

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
    .mutation(async ({ ctx, input }) => {
      await db
        .update(tenants)
        .set({ subscriptionStatus: "paused" })
        .where(eq(tenants.id, input.tenantId));

      await writeAuditLog(ctx, {
        tenantId: input.tenantId,
        action: "permission_change",
        entity: { type: "tenant", id: input.tenantId },
        event: "admin.tenant_suspended",
        summary: "Tenant suspended by system admin",
        changes: { status: "paused", reason: input.reason ?? null },
      });

      return { success: true };
    }),

  /**
   * Unsuspend a tenant
   */
  unsuspendTenant: procedure
    .input(z.object({ tenantId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await db
        .update(tenants)
        .set({ subscriptionStatus: "active" })
        .where(eq(tenants.id, input.tenantId));

      await writeAuditLog(ctx, {
        tenantId: input.tenantId,
        action: "permission_change",
        entity: { type: "tenant", id: input.tenantId },
        event: "admin.tenant_unsuspended",
        summary: "Tenant unsuspended by system admin",
        changes: { status: "active" },
      });

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
    .mutation(async ({ ctx, input }) => {
      await db
        .update(tenants)
        .set({ subscriptionPlan: input.plan })
        .where(eq(tenants.id, input.tenantId));

      await writeAuditLog(ctx, {
        tenantId: input.tenantId,
        action: "config_change",
        entity: { type: "tenant", id: input.tenantId },
        event: "admin.tenant_plan_updated",
        summary: "Tenant plan updated by system admin",
        changes: { plan: input.plan },
      });

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

  /**
   * Cross-tenant observability snapshot for system owners.
   * "Traffic" is approximated by API/system log volume.
   */
  getTenantOverviewStats: procedure
    .input(
      z.object({
        hours: z.number().int().min(1).max(24 * 30).default(24),
        limit: z.number().int().min(1).max(50).default(10),
      })
    )
    .query(async ({ input }) => {
      const since = new Date(Date.now() - input.hours * 60 * 60 * 1000);

      const trafficByTenant = await db
        .select({
          tenantId: systemLogs.tenantId,
          trafficCount: sql<number>`count(*)`,
          errorCount: sql<number>`count(*) filter (where ${systemLogs.level} in ('error', 'critical'))`,
          warnCount: sql<number>`count(*) filter (where ${systemLogs.level} = 'warn')`,
        })
        .from(systemLogs)
        .where(
          and(
            gte(systemLogs.timestamp, since),
            sql`${systemLogs.tenantId} is not null`
          )
        )
        .groupBy(systemLogs.tenantId);

      const changesByTenant = await db
        .select({
          tenantId: auditLogs.tenantId,
          changeCount: sql<number>`count(*) filter (where ${auditLogs.action} in ('create','update','delete','config_change','permission_change'))`,
          deleteCount: sql<number>`count(*) filter (where ${auditLogs.action} = 'delete')`,
          exportCount: sql<number>`count(*) filter (where ${auditLogs.action} = 'export')`,
          auditEventCount: sql<number>`count(*)`,
        })
        .from(auditLogs)
        .where(gte(auditLogs.createdAt, since))
        .groupBy(auditLogs.tenantId);

      const allTenants = await db
        .select({
          id: tenants.id,
          name: tenants.name,
          slug: tenants.slug,
          plan: tenants.subscriptionPlan,
          status: tenants.subscriptionStatus,
        })
        .from(tenants);

      const trafficMap = new Map(
        trafficByTenant.map((row) => [
          row.tenantId!,
          {
            trafficCount: Number(row.trafficCount ?? 0),
            errorCount: Number(row.errorCount ?? 0),
            warnCount: Number(row.warnCount ?? 0),
          },
        ])
      );
      const changeMap = new Map(
        changesByTenant.map((row) => [
          row.tenantId,
          {
            changeCount: Number(row.changeCount ?? 0),
            deleteCount: Number(row.deleteCount ?? 0),
            exportCount: Number(row.exportCount ?? 0),
            auditEventCount: Number(row.auditEventCount ?? 0),
          },
        ])
      );

      const items = allTenants
        .map((tenant) => {
          const traffic = trafficMap.get(tenant.id) ?? {
            trafficCount: 0,
            errorCount: 0,
            warnCount: 0,
          };
          const changes = changeMap.get(tenant.id) ?? {
            changeCount: 0,
            deleteCount: 0,
            exportCount: 0,
            auditEventCount: 0,
          };

          const eventsCount = traffic.trafficCount + changes.auditEventCount;
          const errorRate =
            traffic.trafficCount > 0
              ? (traffic.errorCount / traffic.trafficCount) * 100
              : 0;

          const suspicious =
            errorRate > 20 ||
            changes.deleteCount >= 10 ||
            changes.exportCount >= 5;

          return {
            ...tenant,
            trafficCount: traffic.trafficCount,
            changeCount: changes.changeCount,
            eventsCount,
            errorCount: traffic.errorCount,
            warnCount: traffic.warnCount,
            deleteCount: changes.deleteCount,
            exportCount: changes.exportCount,
            errorRate: Math.round(errorRate * 10) / 10,
            suspicious,
          };
        })
        .sort((a, b) => b.eventsCount - a.eventsCount)
        .slice(0, input.limit);

      return {
        hours: input.hours,
        items,
      };
    }),
});
