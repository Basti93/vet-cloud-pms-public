import { and, desc, eq, gte, sql } from "drizzle-orm";
import { z } from "zod";
import { tenants, vaccinationEmailLogs, vaccinations } from "@/lib/db/schema";
import { createAdminRouter, procedure } from "@/server/adminTrpc";

export const adminVaccinationsRouter = createAdminRouter({
  getGlobalStats: procedure.query(async ({ ctx }) => {
    const [totals] = await ctx.db
      .select({
        total: sql<number>`count(*)`,
        sent: sql<number>`count(*) filter (where ${vaccinationEmailLogs.status} = 'sent')`,
        failed: sql<number>`count(*) filter (where ${vaccinationEmailLogs.status} = 'failed')`,
        lastScanAt: sql<Date | null>`max(${vaccinationEmailLogs.sentAt})`,
      })
      .from(vaccinationEmailLogs);

    const perTenant = await ctx.db
      .select({
        tenantId: vaccinationEmailLogs.tenantId,
        tenantName: tenants.name,
        sent: sql<number>`count(*) filter (where ${vaccinationEmailLogs.status} = 'sent')`,
        failed: sql<number>`count(*) filter (where ${vaccinationEmailLogs.status} = 'failed')`,
      })
      .from(vaccinationEmailLogs)
      .innerJoin(tenants, eq(vaccinationEmailLogs.tenantId, tenants.id))
      .groupBy(vaccinationEmailLogs.tenantId, tenants.name)
      .orderBy(desc(sql<number>`count(*)`))
      .limit(10);

    const total = Number(totals?.total ?? 0);
    const sent = Number(totals?.sent ?? 0);
    const failed = Number(totals?.failed ?? 0);

    return {
      totalRemindersSent: sent,
      totalRemindersFailed: failed,
      successRate: total > 0 ? Math.round((sent / total) * 1000) / 10 : 0,
      lastScanAt: totals?.lastScanAt ?? null,
      averageConversionRate: 0,
      topTenants: perTenant.map((row) => ({
        tenantId: row.tenantId,
        tenantName: row.tenantName,
        sent: Number(row.sent ?? 0),
        failed: Number(row.failed ?? 0),
      })),
    };
  }),

  getTenantStats: procedure
    .input(
      z.object({
        tenantId: z.string().uuid(),
        from: z.date().optional(),
        to: z.date().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const conditions = [eq(vaccinationEmailLogs.tenantId, input.tenantId)];
      if (input.from) conditions.push(gte(vaccinationEmailLogs.sentAt, input.from));

      const [summary] = await ctx.db
        .select({
          total: sql<number>`count(*)`,
          sent: sql<number>`count(*) filter (where ${vaccinationEmailLogs.status} = 'sent')`,
          failed: sql<number>`count(*) filter (where ${vaccinationEmailLogs.status} = 'failed')`,
        })
        .from(vaccinationEmailLogs)
        .where(and(...conditions));

      const recentReminders = await ctx.db
        .select({
          id: vaccinationEmailLogs.id,
          vaccinationId: vaccinationEmailLogs.vaccinationId,
          emailAddress: vaccinationEmailLogs.emailAddress,
          status: vaccinationEmailLogs.status,
          error: vaccinationEmailLogs.error,
          sentAt: vaccinationEmailLogs.sentAt,
          vaccinationType: vaccinations.type,
          expiryDate: vaccinations.expiryDate,
        })
        .from(vaccinationEmailLogs)
        .innerJoin(vaccinations, eq(vaccinationEmailLogs.vaccinationId, vaccinations.id))
        .where(and(...conditions))
        .orderBy(desc(vaccinationEmailLogs.sentAt))
        .limit(100);

      const total = Number(summary?.total ?? 0);
      const sent = Number(summary?.sent ?? 0);
      const failed = Number(summary?.failed ?? 0);

      return {
        tenantId: input.tenantId,
        remindersSentThisPeriod: sent,
        successRate: total > 0 ? Math.round((sent / total) * 1000) / 10 : 0,
        failedCount: failed,
        appointmentConversions: 0,
        conversionRate: 0,
        recentReminders,
      };
    }),

  getFailedReminders: procedure
    .input(
      z.object({
        tenantId: z.string().uuid().optional(),
        limit: z.number().int().min(1).max(200).default(100),
      })
    )
    .query(async ({ ctx, input }) => {
      const conditions = [eq(vaccinationEmailLogs.status, "failed")];
      if (input.tenantId) {
        conditions.push(eq(vaccinationEmailLogs.tenantId, input.tenantId));
      }

      return ctx.db
        .select({
          id: vaccinationEmailLogs.id,
          tenantId: vaccinationEmailLogs.tenantId,
          tenantName: tenants.name,
          vaccinationId: vaccinationEmailLogs.vaccinationId,
          vaccinationType: vaccinations.type,
          ownerEmail: vaccinationEmailLogs.emailAddress,
          failureReason: vaccinationEmailLogs.error,
          failedAt: vaccinationEmailLogs.sentAt,
          retryable: sql<boolean>`true`,
        })
        .from(vaccinationEmailLogs)
        .innerJoin(tenants, eq(vaccinationEmailLogs.tenantId, tenants.id))
        .innerJoin(vaccinations, eq(vaccinationEmailLogs.vaccinationId, vaccinations.id))
        .where(and(...conditions))
        .orderBy(desc(vaccinationEmailLogs.sentAt))
        .limit(input.limit);
    }),

  retryFailedReminder: procedure
    .input(z.object({ logId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [log] = await ctx.db
        .select({
          id: vaccinationEmailLogs.id,
          tenantId: vaccinationEmailLogs.tenantId,
          vaccinationId: vaccinationEmailLogs.vaccinationId,
          emailAddress: vaccinationEmailLogs.emailAddress,
        })
        .from(vaccinationEmailLogs)
        .where(eq(vaccinationEmailLogs.id, input.logId))
        .limit(1);

      if (!log) return { success: false as const, error: "log_not_found" };

      // This endpoint only clears the failure marker; actual resend occurs in cron.
      await ctx.db.insert(vaccinationEmailLogs).values({
        tenantId: log.tenantId,
        vaccinationId: log.vaccinationId,
        emailAddress: log.emailAddress,
        status: "failed",
        error: "queued_for_retry",
      });

      return { success: true as const };
    }),

  getTenantOverview: procedure
    .input(z.object({ days: z.number().int().min(1).max(365).default(30) }))
    .query(async ({ ctx, input }) => {
      const from = new Date(Date.now() - input.days * 24 * 60 * 60 * 1000);

      const rows = await ctx.db
        .select({
          tenantId: vaccinationEmailLogs.tenantId,
          tenantName: tenants.name,
          sent: sql<number>`count(*) filter (where ${vaccinationEmailLogs.status} = 'sent')`,
          failed: sql<number>`count(*) filter (where ${vaccinationEmailLogs.status} = 'failed')`,
        })
        .from(vaccinationEmailLogs)
        .innerJoin(tenants, eq(vaccinationEmailLogs.tenantId, tenants.id))
        .where(gte(vaccinationEmailLogs.sentAt, from))
        .groupBy(vaccinationEmailLogs.tenantId, tenants.name)
        .orderBy(desc(sql<number>`count(*)`));

      return {
        days: input.days,
        items: rows.map((row) => {
          const sent = Number(row.sent ?? 0);
          const failed = Number(row.failed ?? 0);
          const total = sent + failed;
          return {
            tenantId: row.tenantId,
            tenantName: row.tenantName,
            sent,
            failed,
            total,
            successRate: total > 0 ? Math.round((sent / total) * 1000) / 10 : 0,
          };
        }),
      };
    }),
});
