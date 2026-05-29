import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { adminProcedure as procedure, createTRPCRouter as createAdminRouter } from "../trpc";
import { systemLogs, tenants, userFeedback, users } from "@/lib/db/schema";
import { and, desc, eq, sql } from "drizzle-orm";

const feedbackStatusSchema = z.enum(["new", "reviewing", "planned", "done", "dismissed"]);
const feedbackCategorySchema = z.enum(["bug", "idea", "question", "other"]);
const feedbackPrioritySchema = z.enum(["low", "normal", "high"]);

export const adminFeedbackRouter = createAdminRouter({
  getSummary: procedure.query(async ({ ctx }) => {
    const [row] = await ctx.db
      .select({
        total: sql<number>`count(*)`,
        newCount: sql<number>`count(*) filter (where ${userFeedback.status} = 'new')`,
        reviewingCount: sql<number>`count(*) filter (where ${userFeedback.status} = 'reviewing')`,
        highPriorityCount: sql<number>`count(*) filter (where ${userFeedback.priority} = 'high')`,
      })
      .from(userFeedback);

    return {
      total: Number(row?.total ?? 0),
      newCount: Number(row?.newCount ?? 0),
      reviewingCount: Number(row?.reviewingCount ?? 0),
      highPriorityCount: Number(row?.highPriorityCount ?? 0),
    };
  }),

  list: procedure
    .input(
      z.object({
        status: feedbackStatusSchema.optional(),
        category: feedbackCategorySchema.optional(),
        priority: feedbackPrioritySchema.optional(),
        tenantId: z.string().uuid().optional(),
        sourceModule: z.string().trim().min(1).max(80).optional(),
        search: z.string().trim().max(120).optional(),
        limit: z.number().int().min(1).max(100).default(50),
      })
    )
    .query(async ({ ctx, input }) => {
      const conditions = [];

      if (input.status) conditions.push(eq(userFeedback.status, input.status));
      if (input.category) conditions.push(eq(userFeedback.category, input.category));
      if (input.priority) conditions.push(eq(userFeedback.priority, input.priority));
      if (input.tenantId) conditions.push(eq(userFeedback.tenantId, input.tenantId));
      if (input.sourceModule) conditions.push(eq(userFeedback.sourceModule, input.sourceModule));
      if (input.search) {
        const search = `%${input.search}%`;
        conditions.push(
          sql`(${userFeedback.message} ilike ${search} or ${tenants.name} ilike ${search} or ${users.email} ilike ${search})`
        );
      }

      const query = ctx.db
        .select({
          id: userFeedback.id,
          tenantId: userFeedback.tenantId,
          tenantName: tenants.name,
          userId: userFeedback.userId,
          userEmail: users.email,
          userFirstName: users.firstName,
          userLastName: users.lastName,
          sourcePath: userFeedback.sourcePath,
          sourceModule: userFeedback.sourceModule,
          message: userFeedback.message,
          category: userFeedback.category,
          status: userFeedback.status,
          priority: userFeedback.priority,
          triageNotes: userFeedback.triageNotes,
          updatedByAdminClerkId: userFeedback.updatedByAdminClerkId,
          ipAddress: userFeedback.ipAddress,
          userAgent: userFeedback.userAgent,
          browserMetadata: userFeedback.browserMetadata,
          createdAt: userFeedback.createdAt,
          updatedAt: userFeedback.updatedAt,
        })
        .from(userFeedback)
        .leftJoin(tenants, eq(userFeedback.tenantId, tenants.id))
        .leftJoin(users, eq(userFeedback.userId, users.id))
        .orderBy(desc(userFeedback.createdAt))
        .limit(input.limit);

      if (conditions.length > 0) {
        query.where(and(...conditions));
      }

      return { items: await query };
    }),

  update: procedure
    .input(
      z.object({
        feedbackId: z.string().uuid(),
        status: feedbackStatusSchema.optional(),
        priority: feedbackPrioritySchema.optional(),
        triageNotes: z.string().trim().max(4000).nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (
        input.status === undefined &&
        input.priority === undefined &&
        input.triageNotes === undefined
      ) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "No feedback updates provided" });
      }

      const [existing] = await ctx.db
        .select({
          id: userFeedback.id,
          status: userFeedback.status,
          priority: userFeedback.priority,
          triageNotes: userFeedback.triageNotes,
        })
        .from(userFeedback)
        .where(eq(userFeedback.id, input.feedbackId))
        .limit(1);

      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Feedback not found" });
      }

      const [updated] = await ctx.db
        .update(userFeedback)
        .set({
          status: input.status,
          priority: input.priority,
          triageNotes: input.triageNotes,
          updatedByAdminClerkId: ctx.userId,
          updatedAt: new Date(),
        })
        .where(eq(userFeedback.id, input.feedbackId))
        .returning({
          id: userFeedback.id,
          status: userFeedback.status,
          priority: userFeedback.priority,
          triageNotes: userFeedback.triageNotes,
          updatedAt: userFeedback.updatedAt,
        });

      await ctx.db.insert(systemLogs).values({
        level: "info",
        category: "admin",
        eventType: "feedback_updated",
        message: "User feedback triage updated by system admin",
        tenantId: null,
        userId: null,
        metadata: {
          systemAdminId: ctx.userId,
          feedbackId: input.feedbackId,
          before: existing,
          after: updated,
        },
        ipAddress: ctx.headers.get("x-forwarded-for"),
      });

      return updated;
    }),
});
