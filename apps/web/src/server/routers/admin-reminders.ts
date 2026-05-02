import { z } from "zod";
import { createAdminRouter, procedure } from "../adminTrpc";
import { appointmentEmailLogs, tenants } from "@/lib/db/schema";
import { and, desc, eq, gte, sql } from "drizzle-orm";

export const adminRemindersRouter = createAdminRouter({
  getSummary: procedure
    .input(
      z.object({
        tenantId: z.string().uuid().optional(),
        hours: z.number().int().min(1).max(24 * 30).default(24),
      })
    )
    .query(async ({ ctx, input }) => {
      const since = new Date(Date.now() - input.hours * 60 * 60 * 1000);
      const conditions = [
        eq(appointmentEmailLogs.emailType, "reminder"),
        gte(appointmentEmailLogs.sentAt, since),
      ];

      if (input.tenantId) {
        conditions.push(eq(appointmentEmailLogs.tenantId, input.tenantId));
      }

      const [row] = await ctx.db
        .select({
          total: sql<number>`count(*)`,
          sent: sql<number>`count(*) filter (where ${appointmentEmailLogs.status} = 'sent')`,
          failed: sql<number>`count(*) filter (where ${appointmentEmailLogs.status} = 'failed')`,
        })
        .from(appointmentEmailLogs)
        .where(and(...conditions));

      const total = Number(row?.total ?? 0);
      const sent = Number(row?.sent ?? 0);
      const failed = Number(row?.failed ?? 0);
      const successRate = total > 0 ? (sent / total) * 100 : 0;

      return {
        hours: input.hours,
        total,
        sent,
        failed,
        successRate: Math.round(successRate * 10) / 10,
      };
    }),

  listLogs: procedure
    .input(
      z.object({
        tenantId: z.string().uuid().optional(),
        status: z.enum(["sent", "failed"]).optional(),
        limit: z.number().int().min(1).max(200).default(50),
      })
    )
    .query(async ({ ctx, input }) => {
      const conditions = [eq(appointmentEmailLogs.emailType, "reminder")];
      if (input.tenantId) {
        conditions.push(eq(appointmentEmailLogs.tenantId, input.tenantId));
      }
      if (input.status) {
        conditions.push(eq(appointmentEmailLogs.status, input.status));
      }

      const items = await ctx.db
        .select({
          id: appointmentEmailLogs.id,
          tenantId: appointmentEmailLogs.tenantId,
          tenantName: tenants.name,
          appointmentId: appointmentEmailLogs.appointmentId,
          recipientEmail: appointmentEmailLogs.recipientEmail,
          status: appointmentEmailLogs.status,
          errorMessage: appointmentEmailLogs.errorMessage,
          sentAt: appointmentEmailLogs.sentAt,
        })
        .from(appointmentEmailLogs)
        .innerJoin(tenants, eq(appointmentEmailLogs.tenantId, tenants.id))
        .where(and(...conditions))
        .orderBy(desc(appointmentEmailLogs.sentAt))
        .limit(input.limit);

      return { items };
    }),
});

