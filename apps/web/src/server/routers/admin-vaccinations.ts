import { and, desc, eq, gte, sql } from "drizzle-orm";
import { z } from "zod";
import { appointments, tenants, vaccinationEmailLogs, vaccinations } from "@/lib/db/schema";
import { createAdminRouter, procedure } from "@/server/adminTrpc";

/**
 * SQL fragment: true if a reminder in vaccination_email_logs resulted in an
 * appointment being booked within 14 days for the same patient.
 * Used as a FILTER predicate inside count() / as a column.
 */
const conversionExists = sql<boolean>`exists (
  select 1
  from ${appointments} a
  join ${vaccinations} v on v.id = ${vaccinationEmailLogs.vaccinationId}
  where a.patient_id = v.patient_id
    and a.tenant_id = ${vaccinationEmailLogs.tenantId}
    and a.start_time >= ${vaccinationEmailLogs.sentAt}
    and a.start_time <= ${vaccinationEmailLogs.sentAt} + interval '14 days'
)`;

export const adminVaccinationsRouter = createAdminRouter({
  getGlobalStats: procedure.query(async ({ ctx }) => {
    const [totals] = await ctx.db
      .select({
        total: sql<number>`count(*)`,
        sent: sql<number>`count(*) filter (where ${vaccinationEmailLogs.status} = 'sent')`,
        failed: sql<number>`count(*) filter (where ${vaccinationEmailLogs.status} = 'failed')`,
        conversions: sql<number>`count(*) filter (
          where ${vaccinationEmailLogs.status} = 'sent'
          and ${conversionExists}
        )`,
        lastScanAt: sql<Date | null>`max(${vaccinationEmailLogs.sentAt})`,
      })
      .from(vaccinationEmailLogs);

    const perTenant = await ctx.db
      .select({
        tenantId: vaccinationEmailLogs.tenantId,
        tenantName: tenants.name,
        sent: sql<number>`count(*) filter (where ${vaccinationEmailLogs.status} = 'sent')`,
        failed: sql<number>`count(*) filter (where ${vaccinationEmailLogs.status} = 'failed')`,
        conversions: sql<number>`count(*) filter (
          where ${vaccinationEmailLogs.status} = 'sent'
          and ${conversionExists}
        )`,
      })
      .from(vaccinationEmailLogs)
      .innerJoin(tenants, eq(vaccinationEmailLogs.tenantId, tenants.id))
      .groupBy(vaccinationEmailLogs.tenantId, tenants.name)
      .orderBy(desc(sql<number>`count(*)`))
      .limit(10);

    const sent = Number(totals?.sent ?? 0);
    const failed = Number(totals?.failed ?? 0);
    const conversions = Number(totals?.conversions ?? 0);

    return {
      totalRemindersSent: sent,
      totalRemindersFailed: failed,
      successRate: (sent + failed) > 0 ? Math.round((sent / (sent + failed)) * 1000) / 10 : 0,
      lastScanAt: totals?.lastScanAt ?? null,
      totalConversions: conversions,
      averageConversionRate: sent > 0 ? Math.round((conversions / sent) * 1000) / 10 : 0,
      topTenants: perTenant.map((row) => {
        const rowSent = Number(row.sent ?? 0);
        const rowConversions = Number(row.conversions ?? 0);
        return {
          tenantId: row.tenantId,
          tenantName: row.tenantName,
          sent: rowSent,
          failed: Number(row.failed ?? 0),
          conversions: rowConversions,
          conversionRate: rowSent > 0 ? Math.round((rowConversions / rowSent) * 1000) / 10 : 0,
        };
      }),
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
          conversions: sql<number>`count(*) filter (
            where ${vaccinationEmailLogs.status} = 'sent'
            and ${conversionExists}
          )`,
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
          converted: conversionExists,
        })
        .from(vaccinationEmailLogs)
        .innerJoin(vaccinations, eq(vaccinationEmailLogs.vaccinationId, vaccinations.id))
        .where(and(...conditions))
        .orderBy(desc(vaccinationEmailLogs.sentAt))
        .limit(100);

      const sent = Number(summary?.sent ?? 0);
      const failed = Number(summary?.failed ?? 0);
      const conversions = Number(summary?.conversions ?? 0);

      return {
        tenantId: input.tenantId,
        remindersSentThisPeriod: sent,
        successRate: (sent + failed) > 0 ? Math.round((sent / (sent + failed)) * 1000) / 10 : 0,
        failedCount: failed,
        appointmentConversions: conversions,
        conversionRate: sent > 0 ? Math.round((conversions / sent) * 1000) / 10 : 0,
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
        })
        .from(vaccinationEmailLogs)
        .innerJoin(tenants, eq(vaccinationEmailLogs.tenantId, tenants.id))
        .innerJoin(vaccinations, eq(vaccinationEmailLogs.vaccinationId, vaccinations.id))
        .where(and(...conditions))
        .orderBy(desc(vaccinationEmailLogs.sentAt))
        .limit(input.limit);
    }),

  /**
   * Reset a vaccination's reminderSentDate so the next cron run will retry.
   * Failed reminders are retried automatically by cron (they never set
   * reminderSentDate). Use this to force a re-send for a prior successful send.
   */
  retryFailedReminder: procedure
    .input(z.object({ logId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [log] = await ctx.db
        .select({
          id: vaccinationEmailLogs.id,
          vaccinationId: vaccinationEmailLogs.vaccinationId,
        })
        .from(vaccinationEmailLogs)
        .where(eq(vaccinationEmailLogs.id, input.logId))
        .limit(1);

      if (!log) return { success: false as const, error: "log_not_found" };

      await ctx.db
        .update(vaccinations)
        .set({ reminderSentDate: null, updatedAt: new Date() })
        .where(eq(vaccinations.id, log.vaccinationId));

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
          conversions: sql<number>`count(*) filter (
            where ${vaccinationEmailLogs.status} = 'sent'
            and ${conversionExists}
          )`,
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
          const conversions = Number(row.conversions ?? 0);
          const total = sent + failed;
          return {
            tenantId: row.tenantId,
            tenantName: row.tenantName,
            sent,
            failed,
            total,
            conversions,
            successRate: total > 0 ? Math.round((sent / total) * 1000) / 10 : 0,
            conversionRate: sent > 0 ? Math.round((conversions / sent) * 1000) / 10 : 0,
          };
        }),
      };
    }),
});
