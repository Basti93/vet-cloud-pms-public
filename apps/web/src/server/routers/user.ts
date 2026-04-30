import { z } from "zod";
import { eq } from "drizzle-orm";
import { createTRPCRouter, protectedProcedure } from "@/server/trpc";
import { users } from "@/lib/db/schema";
import { TRPCError } from "@trpc/server";

export const userRouter = createTRPCRouter({
  /**
   * Update current user's locale preference
   * Protected: Auth required
   */
  updateLocale: protectedProcedure
    .input(
      z.object({
        locale: z.enum(["de", "en"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.userId) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Not authenticated",
        });
      }

      try {
        const [updatedUser] = await ctx.db
          .update(users)
          .set({ locale: input.locale })
          .where(eq(users.id, ctx.userId))
          .returning();

        if (!updatedUser) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "User not found",
          });
        }

        return updatedUser;
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update locale",
        });
      }
    }),

  /**
   * Get current user's locale preference
   * Protected: Auth required
   */
  getLocale: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.userId) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Not authenticated",
      });
    }

    const [user] = await ctx.db
      .select({ locale: users.locale })
      .from(users)
      .where(eq(users.id, ctx.userId));

    if (!user) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "User not found",
      });
    }

    return { locale: user.locale };
  }),
});
