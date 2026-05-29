import { z } from "zod";
import { adminProcedure, protectedProcedure, createTRPCRouter } from "../trpc";
import { emailLogs, tenants, EMAIL_TYPES } from "@/lib/db/schema";
import { and, desc, eq, gte, isNull, or, sql, lte } from "drizzle-orm";

export const emailLogsRouter = createTRPCRouter({
  // Admin: failure count for nav badge
  getFailureBadge: adminProcedure.query(async ({ ctx }) => {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [row] = await ctx.db
      .select({ count: sql<number>`count(*)` })
      .from(emailLogs)
      .where(and(eq(emailLogs.status, "failed"), gte(emailLogs.sentAt, since)));
    return { failedLast24h: Number(row?.count ?? 0) };
  }),

  // Admin: summary stats
  getAdminSummary: adminProcedure
    .input(
      z.object({
        hours: z.number().int().min(1).max(24 * 30).default(24),
        tenantId: z.string().uuid().optional(),
        emailType: z.enum(EMAIL_TYPES).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const since = new Date(Date.now() - input.hours * 60 * 60 * 1000);
      const conditions = [gte(emailLogs.sentAt, since)];
      if (input.tenantId) conditions.push(eq(emailLogs.tenantId, input.tenantId));
      if (input.emailType) conditions.push(eq(emailLogs.emailType, input.emailType));

      const [row] = await ctx.db
        .select({
          total: sql<number>`count(*)`,
          sent: sql<number>`count(*) filter (where ${emailLogs.status} = 'sent')`,
          failed: sql<number>`count(*) filter (where ${emailLogs.status} = 'failed')`,
        })
        .from(emailLogs)
        .where(and(...conditions));

      const total = Number(row?.total ?? 0);
      const sent = Number(row?.sent ?? 0);
      const failed = Number(row?.failed ?? 0);
      return {
        hours: input.hours,
        total,
        sent,
        failed,
        successRate: total > 0 ? Math.round((sent / total) * 1000) / 10 : 0,
      };
    }),

  // Admin: paginated log list
  listAdmin: adminProcedure
    .input(
      z.object({
        tenantId: z.string().uuid().optional(),
        emailType: z.enum(EMAIL_TYPES).optional(),
        status: z.enum(["sent", "failed"]).optional(),
        from: z.date().optional(),
        to: z.date().optional(),
        limit: z.number().int().min(1).max(200).default(50),
        offset: z.number().int().min(0).default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      const conditions = [];
      if (input.tenantId) conditions.push(eq(emailLogs.tenantId, input.tenantId));
      if (input.emailType) conditions.push(eq(emailLogs.emailType, input.emailType));
      if (input.status) conditions.push(eq(emailLogs.status, input.status));
      if (input.from) conditions.push(gte(emailLogs.sentAt, input.from));
      if (input.to) conditions.push(lte(emailLogs.sentAt, input.to));

      const items = await ctx.db
        .select({
          id: emailLogs.id,
          tenantId: emailLogs.tenantId,
          tenantName: tenants.name,
          emailType: emailLogs.emailType,
          recipientEmail: emailLogs.recipientEmail,
          status: emailLogs.status,
          errorMessage: emailLogs.errorMessage,
          messageId: emailLogs.messageId,
          sentAt: emailLogs.sentAt,
        })
        .from(emailLogs)
        .leftJoin(tenants, eq(emailLogs.tenantId, tenants.id))
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(emailLogs.sentAt))
        .limit(input.limit)
        .offset(input.offset);

      return { items };
    }),

  // Tenant: delivery rate for statistics page
  getTenantDeliveryRate: protectedProcedure
    .input(
      z.object({
        tenantId: z.string().uuid(),
        from: z.date(),
        to: z.date(),
      })
    )
    .query(async ({ ctx, input }) => {
      const [row] = await ctx.db
        .select({
          total: sql<number>`count(*)`,
          sent: sql<number>`count(*) filter (where ${emailLogs.status} = 'sent')`,
          failed: sql<number>`count(*) filter (where ${emailLogs.status} = 'failed')`,
        })
        .from(emailLogs)
        .where(
          and(
            eq(emailLogs.tenantId, input.tenantId),
            gte(emailLogs.sentAt, input.from),
            lte(emailLogs.sentAt, input.to)
          )
        );

      const total = Number(row?.total ?? 0);
      const sent = Number(row?.sent ?? 0);
      const failed = Number(row?.failed ?? 0);
      return {
        total,
        sent,
        failed,
        deliveryRate: total > 0 ? Math.round((sent / total) * 1000) / 10 : 0,
      };
    }),
});
