import { z } from "zod";
import { createAdminRouter, procedure } from "../adminTrpc";
import { db } from "@/lib/db/client";
import { tenants, users, auditLogs, systemLogs, appointments } from "@/lib/db/schema";
import { eq, like, desc, and, count, gte, lte, lt, sql } from "drizzle-orm";
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
        tenantId: z.string().uuid().optional(),
        from: z.string().datetime().optional(),
        to: z.string().datetime().optional(),
      })
    )
    .query(async ({ input }) => {
      const toDate = input.to ? new Date(input.to) : new Date();
      const fromDate = input.from
        ? new Date(input.from)
        : new Date(toDate.getTime() - input.hours * 60 * 60 * 1000);
      const since = fromDate;

      const rangeMs = Math.max(1, toDate.getTime() - fromDate.getTime());
      const previousFrom = new Date(fromDate.getTime() - rangeMs);
      const previousTo = fromDate;
      const now = new Date();
      const day = now.getUTCDay(); // 0=Sunday
      const diffToMonday = day === 0 ? 6 : day - 1;
      const currentWeekStart = new Date(
        Date.UTC(
          now.getUTCFullYear(),
          now.getUTCMonth(),
          now.getUTCDate() - diffToMonday,
          0,
          0,
          0,
          0
        )
      );
      const previousWeekStart = new Date(currentWeekStart.getTime() - 7 * 24 * 60 * 60 * 1000);

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
            lte(systemLogs.timestamp, toDate),
            input.tenantId ? eq(systemLogs.tenantId, input.tenantId) : undefined,
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
        .where(
          and(
            gte(auditLogs.createdAt, since),
            lte(auditLogs.createdAt, toDate),
            input.tenantId ? eq(auditLogs.tenantId, input.tenantId) : undefined
          )
        )
        .groupBy(auditLogs.tenantId);

      const appointmentsCurrentWeek = await db
        .select({
          tenantId: appointments.tenantId,
          count: sql<number>`count(*)`,
        })
        .from(appointments)
        .where(
          and(
            gte(appointments.startTime, fromDate),
            lte(appointments.startTime, toDate),
            input.tenantId ? eq(appointments.tenantId, input.tenantId) : undefined,
            sql`${appointments.tenantId} is not null`
          )
        )
        .groupBy(appointments.tenantId);

      const appointmentsPreviousWeek = await db
        .select({
          tenantId: appointments.tenantId,
          count: sql<number>`count(*)`,
        })
        .from(appointments)
        .where(
          and(
            gte(appointments.startTime, previousFrom),
            lt(appointments.startTime, previousTo),
            input.tenantId ? eq(appointments.tenantId, input.tenantId) : undefined,
            sql`${appointments.tenantId} is not null`
          )
        )
        .groupBy(appointments.tenantId);

      const allTenants = await db
        .select({
          id: tenants.id,
          name: tenants.name,
          slug: tenants.slug,
          plan: tenants.subscriptionPlan,
          status: tenants.subscriptionStatus,
        })
        .from(tenants);
      const tenantsFiltered = input.tenantId
        ? allTenants.filter((tenant) => tenant.id === input.tenantId)
        : allTenants;

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
      const appointmentsCurrentMap = new Map(
        appointmentsCurrentWeek.map((row) => [row.tenantId!, Number(row.count ?? 0)])
      );
      const appointmentsPreviousMap = new Map(
        appointmentsPreviousWeek.map((row) => [row.tenantId!, Number(row.count ?? 0)])
      );

      const items = tenantsFiltered
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
          const appointmentsThisWeek = appointmentsCurrentMap.get(tenant.id) ?? 0;
          const appointmentsLastWeek = appointmentsPreviousMap.get(tenant.id) ?? 0;
          const appointmentDelta = appointmentsThisWeek - appointmentsLastWeek;
          const appointmentDeltaPct =
            appointmentsLastWeek > 0
              ? (appointmentDelta / appointmentsLastWeek) * 100
              : appointmentsThisWeek > 0
              ? 100
              : 0;
          const appointmentTrend =
            appointmentDeltaPct > 5
              ? "growing"
              : appointmentDeltaPct < -5
              ? "shrinking"
              : "stable";

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
            appointmentsThisWeek,
            appointmentsLastWeek,
            appointmentDelta,
            appointmentDeltaPct: Math.round(appointmentDeltaPct * 10) / 10,
            appointmentTrend,
          };
        })
        .sort((a, b) => {
          if (b.appointmentsThisWeek !== a.appointmentsThisWeek) {
            return b.appointmentsThisWeek - a.appointmentsThisWeek;
          }
          return b.eventsCount - a.eventsCount;
        })
        .slice(0, input.limit);

      return {
        hours: input.hours,
        from: fromDate.toISOString(),
        to: toDate.toISOString(),
        currentWeekStart: currentWeekStart.toISOString(),
        previousWeekStart: previousWeekStart.toISOString(),
        items,
      };
    }),
});
