import { z } from "zod";
import { createAdminRouter, procedure } from "../adminTrpc";
import { db } from "@/lib/db/client";
import { TRPCError } from "@trpc/server";
import {
  tenants,
  users,
  roles,
  auditLogs,
  systemLogs,
  appointments,
  tenantDeletionSchedules,
  featureFlags,
} from "@/lib/db/schema";
import { eq, like, desc, and, count, gte, lte, lt, sql, inArray } from "drizzle-orm";
import { writeAuditLog } from "@/server/audit";
import { executeDueTenantDeletions, hardDeleteTenantById } from "@/server/tenant-deletion";
import { sendTenantLifecycleEmail } from "@/lib/email/service";
import { randomUUID } from "crypto";
import { createDefaultRoles } from "@/lib/auth/permissions";
import { invalidateAllRolePermissions } from "@/lib/auth/permission-cache";
import { getPriceById } from "@/lib/stripe/prices";

function getStripeDashboardUrls(stripeCustomerId: string | null, stripeSubscriptionId: string | null) {
  const isTestMode = (process.env.STRIPE_SECRET_KEY ?? "").startsWith("sk_test_");
  const prefix = isTestMode ? "test/" : "";
  return {
    customerUrl: stripeCustomerId
      ? `https://dashboard.stripe.com/${prefix}customers/${stripeCustomerId}`
      : null,
    subscriptionUrl: stripeSubscriptionId
      ? `https://dashboard.stripe.com/${prefix}subscriptions/${stripeSubscriptionId}`
      : null,
  };
}

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
        stripeCustomerId: tenants.stripeCustomerId,
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

      const deletionSchedules = await db
        .select({
          tenantId: tenantDeletionSchedules.tenantId,
          deletionStatus: tenantDeletionSchedules.status,
          deletionScheduledFor: tenantDeletionSchedules.scheduledFor,
        })
        .from(tenantDeletionSchedules)
        .where(
          items.length > 0
            ? inArray(
                tenantDeletionSchedules.tenantId,
                items.map((item) => item.id)
              )
            : undefined
        );
      const deletionMap = new Map(
        deletionSchedules.map((row) => [row.tenantId, row])
      );

      return {
        items: tenantsWithCounts.map((tenant) => {
          const deletion = deletionMap.get(tenant.id);
          return {
            ...tenant,
            deletionStatus: deletion?.deletionStatus ?? null,
            deletionScheduledFor: deletion?.deletionScheduledFor ?? null,
          };
        }),
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

      const [flags] = await db
        .select({ aiReceptionEnabled: featureFlags.aiReceptionEnabled })
        .from(featureFlags)
        .where(eq(featureFlags.tenantId, tenant.id))
        .limit(1);
      const [systemRoleLockState] = await db
        .select({
          editableCount: sql<number>`count(*) filter (where ${roles.isSystem} = true and ${roles.isEditableByTenant} = true)`,
          totalSystemCount: sql<number>`count(*) filter (where ${roles.isSystem} = true)`,
        })
        .from(roles)
        .where(eq(roles.tenantId, tenant.id));

      return {
        ...tenant,
        userCount: userCountResult?.count ?? 0,
        featureFlags: {
          aiReceptionEnabled: flags?.aiReceptionEnabled ?? false,
        },
        systemRolesEditable:
          Number(systemRoleLockState?.editableCount ?? 0) > 0 &&
          Number(systemRoleLockState?.totalSystemCount ?? 0) > 0,
        stripeDashboardUrls: getStripeDashboardUrls(tenant.stripeCustomerId, tenant.stripeSubscriptionId),
        currentPriceLabel: tenant.currentStripePriceId ? getPriceById(tenant.currentStripePriceId) : null,
      };
    }),

  setSystemRolesEditable: procedure
    .input(
      z.object({
        tenantId: z.string().uuid(),
        editable: z.boolean(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await createDefaultRoles(input.tenantId);
      await db
        .update(roles)
        .set({
          isEditableByTenant: input.editable,
        })
        .where(and(eq(roles.tenantId, input.tenantId), eq(roles.isSystem, true)));

      // Re-sync canonical system permissions when locking back down
      if (!input.editable) {
        await createDefaultRoles(input.tenantId);
      }

      await writeAuditLog(ctx, {
        tenantId: input.tenantId,
        action: "permission_change",
        entity: { type: "tenant_roles", id: input.tenantId },
        event: input.editable
          ? "admin.tenant_system_roles_unlocked"
          : "admin.tenant_system_roles_locked",
        summary: input.editable
          ? "System roles unlocked for tenant customization"
          : "System roles locked to platform defaults",
        changes: { editable: input.editable },
      });

      // Invalidate all role permission caches since system roles were reconfigured
      invalidateAllRolePermissions();

      return { success: true };
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

  updateFeatureFlags: procedure
    .input(
      z.object({
        tenantId: z.string().uuid(),
        aiReceptionEnabled: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [tenant] = await db
        .select({ id: tenants.id })
        .from(tenants)
        .where(eq(tenants.id, input.tenantId))
        .limit(1);
      if (!tenant) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Tenant not found" });
      }

      const [existing] = await db
        .select({ id: featureFlags.id })
        .from(featureFlags)
        .where(eq(featureFlags.tenantId, input.tenantId))
        .limit(1);

      const updateData: Record<string, unknown> = {
        updatedAt: new Date(),
      };
      if (input.aiReceptionEnabled !== undefined) {
        updateData.aiReceptionEnabled = input.aiReceptionEnabled;
      }

      if (existing) {
        await db
          .update(featureFlags)
          .set(updateData)
          .where(eq(featureFlags.tenantId, input.tenantId));
      } else {
        await db.insert(featureFlags).values({
          id: randomUUID(),
          tenantId: input.tenantId,
          ...updateData,
        });
      }

      await writeAuditLog(ctx, {
        tenantId: input.tenantId,
        action: "config_change",
        entity: { type: "feature_flags", id: input.tenantId },
        event: "admin.tenant_feature_flags_updated",
        summary: "Tenant feature flags updated by system admin",
        changes: {
          aiReceptionEnabled: input.aiReceptionEnabled,
        },
      });

      return { success: true };
    }),

  scheduleTenantDeletion: procedure
    .input(
      z.object({
        tenantId: z.string().uuid(),
        confirmationText: z.string().min(1),
        reason: z.string().max(1000).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [tenant] = await db
        .select({
          id: tenants.id,
          slug: tenants.slug,
          name: tenants.name,
          email: tenants.email,
          subscriptionStatus: tenants.subscriptionStatus,
        })
        .from(tenants)
        .where(eq(tenants.id, input.tenantId))
        .limit(1);

      if (!tenant) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Tenant not found" });
      }
      const isProd = process.env.NODE_ENV === "production" &&
        process.env.NEXT_PUBLIC_APP_ENV === "production";
      if (tenant.slug === "demo" && isProd) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Demo tenant cannot be scheduled for deletion in production.",
        });
      }

      const expected = `DELETE ${tenant.slug}`;
      if (input.confirmationText.trim() !== expected) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Confirmation text mismatch. Expected: "${expected}"`,
        });
      }

      const scheduledFor = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

      const existing = await db
        .select({ id: tenantDeletionSchedules.id })
        .from(tenantDeletionSchedules)
        .where(eq(tenantDeletionSchedules.tenantId, input.tenantId))
        .limit(1);

      if (existing[0]) {
        await db
          .update(tenantDeletionSchedules)
          .set({
            status: "scheduled",
            previousSubscriptionStatus: tenant.subscriptionStatus,
            reason: input.reason ?? null,
            scheduledFor,
            cancelledAt: null,
            executedAt: null,
            updatedAt: new Date(),
          })
          .where(eq(tenantDeletionSchedules.id, existing[0].id));
      } else {
        await db.insert(tenantDeletionSchedules).values({
          tenantId: input.tenantId,
          requestedByUserId: null,
          status: "scheduled",
          previousSubscriptionStatus: tenant.subscriptionStatus,
          reason: input.reason ?? null,
          scheduledFor,
        });
      }

      await db
        .update(tenants)
        .set({ subscriptionStatus: "paused" })
        .where(eq(tenants.id, input.tenantId));

      await writeAuditLog(ctx, {
        tenantId: input.tenantId,
        action: "delete",
        entity: { type: "tenant", id: input.tenantId },
        event: "admin.tenant_deletion_scheduled",
        summary: "Tenant deletion scheduled for +30 days",
        changes: {
          scheduledFor: scheduledFor.toISOString(),
          reason: input.reason ?? null,
        },
      });

      if (tenant.email) {
        await sendTenantLifecycleEmail({
          to: tenant.email,
          practiceName: tenant.name,
          subject: `Praxis deaktiviert: ${tenant.name}`,
          body: `Ihre Praxis wurde durch den System-Admin deaktiviert. Geplante Löschung: ${scheduledFor.toLocaleString(
            "de-DE"
          )}. Bitte nutzen Sie den Reaktivierungslink aus der Deaktivierungs-Email oder kontaktieren Sie den Support.`,
        });
      }

      return { success: true, scheduledFor: scheduledFor.toISOString() };
    }),

  cancelTenantDeletion: procedure
    .input(z.object({ tenantId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [tenant] = await db
        .select({ name: tenants.name, email: tenants.email })
        .from(tenants)
        .where(eq(tenants.id, input.tenantId))
        .limit(1);

      await db
        .update(tenantDeletionSchedules)
        .set({ status: "cancelled", cancelledAt: new Date(), updatedAt: new Date() })
        .where(eq(tenantDeletionSchedules.tenantId, input.tenantId));

      const [schedule] = await db
        .select({ previousSubscriptionStatus: tenantDeletionSchedules.previousSubscriptionStatus })
        .from(tenantDeletionSchedules)
        .where(eq(tenantDeletionSchedules.tenantId, input.tenantId))
        .limit(1);
      const restoredStatus = schedule?.previousSubscriptionStatus ?? "active";

      await db
        .update(tenants)
        .set({ subscriptionStatus: restoredStatus, updatedAt: new Date() })
        .where(eq(tenants.id, input.tenantId));

      await writeAuditLog(ctx, {
        tenantId: input.tenantId,
        action: "delete",
        entity: { type: "tenant", id: input.tenantId },
        event: "admin.tenant_deletion_cancelled",
        summary: "Scheduled tenant deletion cancelled by system admin",
        changes: { cancelledAt: new Date().toISOString() },
      });

      if (tenant?.email) {
        await sendTenantLifecycleEmail({
          to: tenant.email,
          practiceName: tenant.name,
          subject: `Praxis reaktiviert: ${tenant.name}`,
          body: "Die geplante Löschung wurde durch den System-Admin abgebrochen. Ihre Praxis ist wieder aktiv.",
        });
      }

      return { success: true };
    }),

  runDeletionCleanupNow: procedure.mutation(async ({ ctx: _ctx }) => {
    const result = await executeDueTenantDeletions();
    console.info("Manual tenant deletion cleanup executed", result);
    return result;
  }),

  debugHardDeleteNow: procedure
    .input(
      z.object({
        tenantId: z.string().uuid(),
        confirmationText: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const isProd = process.env.NODE_ENV === "production" &&
        process.env.NEXT_PUBLIC_APP_ENV === "production";
      if (isProd) {
        throw new Error("Debug hard-delete is disabled in production.");
      }

      const [tenant] = await db
        .select({ id: tenants.id, slug: tenants.slug })
        .from(tenants)
        .where(eq(tenants.id, input.tenantId))
        .limit(1);
      if (!tenant) {
        throw new Error("Tenant not found");
      }

      const expected = `DELETE NOW ${tenant.slug}`;
      if (input.confirmationText.trim() !== expected) {
        throw new Error(`Confirmation text mismatch. Expected: "${expected}"`);
      }

      const [schedule] = await db
        .select({ id: tenantDeletionSchedules.id })
        .from(tenantDeletionSchedules)
        .where(
          and(
            eq(tenantDeletionSchedules.tenantId, input.tenantId),
            eq(tenantDeletionSchedules.status, "scheduled")
          )
        )
        .limit(1);
      if (!schedule) {
        throw new Error("Tenant must be deactivated first before debug hard-delete.");
      }

      await writeAuditLog(ctx, {
        tenantId: input.tenantId,
        action: "delete",
        entity: { type: "tenant", id: input.tenantId },
        event: "admin.tenant_debug_hard_delete_executed",
        summary: "System admin executed immediate hard-delete before 30-day deadline",
        changes: { tenantSlug: tenant.slug },
      });

      await hardDeleteTenantById(input.tenantId);
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
