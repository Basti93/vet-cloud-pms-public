import { z } from "zod";
import { createTRPCRouter, tenantProcedure } from "@/server/trpc";
import { userFeedback } from "@/lib/db/schema";

const feedbackCategorySchema = z.enum(["bug", "idea", "question", "other"]);

export const feedbackRouter = createTRPCRouter({
  submit: tenantProcedure
    .input(
      z.object({
        message: z.string().trim().min(1).max(4000),
        category: feedbackCategorySchema.default("other"),
        sourcePath: z.string().trim().min(1).max(500),
        sourceModule: z.string().trim().min(1).max(80),
        browserMetadata: z
          .object({
            viewport: z
              .object({
                width: z.number().int().positive().optional(),
                height: z.number().int().positive().optional(),
              })
              .optional(),
            language: z.string().max(80).optional(),
          })
          .optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { tenantId, dbUserId } = ctx as { tenantId: string; dbUserId: string };

      const [created] = await ctx.db
        .insert(userFeedback)
        .values({
          tenantId,
          userId: dbUserId,
          message: input.message,
          category: input.category,
          sourcePath: input.sourcePath,
          sourceModule: input.sourceModule,
          browserMetadata: input.browserMetadata ?? null,
          ipAddress: ctx.headers.get("x-forwarded-for"),
          userAgent: ctx.headers.get("user-agent"),
        })
        .returning({
          id: userFeedback.id,
          status: userFeedback.status,
          createdAt: userFeedback.createdAt,
        });

      return created;
    }),
});
