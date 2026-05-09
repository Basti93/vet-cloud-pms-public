import { z } from "zod";
import { createAdminRouter, procedure } from "../adminTrpc";
import { contactRequests } from "@/lib/db/schema";
import { and, desc, eq, sql } from "drizzle-orm";

export const adminContactRequestsRouter = createAdminRouter({
  getSummary: procedure.query(async ({ ctx }) => {
    const [row] = await ctx.db
      .select({
        total: sql<number>`count(*)`,
        sent: sql<number>`count(*) filter (where ${contactRequests.emailStatus} = 'sent')`,
        failed: sql<number>`count(*) filter (where ${contactRequests.emailStatus} = 'failed')`,
        websiteInterest: sql<number>`count(*) filter (where ${contactRequests.websiteInterest} = true)`,
      })
      .from(contactRequests);

    return {
      total: Number(row?.total ?? 0),
      sent: Number(row?.sent ?? 0),
      failed: Number(row?.failed ?? 0),
      websiteInterest: Number(row?.websiteInterest ?? 0),
    };
  }),

  list: procedure
    .input(
      z.object({
        status: z.enum(["pending", "sent", "failed"]).optional(),
        websiteInterest: z.boolean().optional(),
        search: z.string().trim().max(120).optional(),
        limit: z.number().int().min(1).max(20).default(20),
      })
    )
    .query(async ({ ctx, input }) => {
      const conditions = [];

      if (input.status) {
        conditions.push(eq(contactRequests.emailStatus, input.status));
      }

      if (input.websiteInterest !== undefined) {
        conditions.push(eq(contactRequests.websiteInterest, input.websiteInterest));
      }

      if (input.search) {
        const search = `%${input.search}%`;
        conditions.push(
          sql`(${contactRequests.name} ilike ${search} or ${contactRequests.email} ilike ${search} or ${contactRequests.practiceName} ilike ${search})`
        );
      }

      const query = ctx.db
        .select({
          id: contactRequests.id,
          name: contactRequests.name,
          email: contactRequests.email,
          phone: contactRequests.phone,
          practiceName: contactRequests.practiceName,
          role: contactRequests.role,
          websiteInterest: contactRequests.websiteInterest,
          message: contactRequests.message,
          emailStatus: contactRequests.emailStatus,
          emailSentAt: contactRequests.emailSentAt,
          emailError: contactRequests.emailError,
          ipAddress: contactRequests.ipAddress,
          userAgent: contactRequests.userAgent,
          createdAt: contactRequests.createdAt,
        })
        .from(contactRequests)
        .orderBy(desc(contactRequests.createdAt))
        .limit(input.limit);

      if (conditions.length > 0) {
        query.where(and(...conditions));
      }

      const items = await query;
      return { items };
    }),
});
