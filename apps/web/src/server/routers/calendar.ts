import { createTRPCRouter, protectedProcedure } from "@/server/trpc";
import { z } from "zod";
import { calendarAccessTokens, calendarAccessAudit, users, PERMISSIONS } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { randomUUID } from "crypto";
import { hasPermission } from "@/lib/auth/permissions";
import { TRPCError } from "@trpc/server";

export const calendarRouter = createTRPCRouter({
  generateToken: protectedProcedure
    .input(
      z.object({
        description: z.string().max(255).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Get current user context
      const [currentUser] = await ctx.db
        .select({
          id: users.id,
          tenantId: users.tenantId,
        })
        .from(users)
        .where(eq(users.clerkId, ctx.userId))
        .limit(1);

      if (!currentUser) {
        throw new Error("User not found");
      }

      // Permission-based guard (replaces role hard-coding)
      const canManageSchedule = await hasPermission(
        ctx.userId!,
        PERMISSIONS.SCHEDULE_MANAGE
      );
      if (!canManageSchedule) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: `Missing permission: ${PERMISSIONS.SCHEDULE_MANAGE}`,
        });
      }

      // Generate non-guessable UUID token
      const token = randomUUID();

      // Create the access token
      const [newToken] = await ctx.db
        .insert(calendarAccessTokens)
        .values({
          id: randomUUID(),
          tenantId: currentUser.tenantId,
          vetId: currentUser.id,
          token,
          isActive: true,
          description: input.description || "Calendar Feed",
          createdAt: new Date(),
          createdBy: currentUser.id,
        })
        .returning();

      return {
        id: newToken.id,
        token: newToken.token,
        description: newToken.description,
        createdAt: newToken.createdAt,
        lastUsedAt: newToken.lastUsedAt,
      };
    }),

  listTokens: protectedProcedure.query(async ({ ctx }) => {
    // Get current user
    const [currentUser] = await ctx.db
      .select({
        id: users.id,
        tenantId: users.tenantId,
      })
      .from(users)
      .where(eq(users.clerkId, ctx.userId))
      .limit(1);

    if (!currentUser) {
      throw new Error("User not found");
    }

    // Get all active tokens for this vet (don't expose token value for security)
    const tokens = await ctx.db
      .select({
        id: calendarAccessTokens.id,
        token: calendarAccessTokens.token,
        description: calendarAccessTokens.description,
        createdAt: calendarAccessTokens.createdAt,
        lastUsedAt: calendarAccessTokens.lastUsedAt,
        isActive: calendarAccessTokens.isActive,
      })
      .from(calendarAccessTokens)
      .where(
        and(
          eq(calendarAccessTokens.tenantId, currentUser.tenantId),
          eq(calendarAccessTokens.vetId, currentUser.id),
          eq(calendarAccessTokens.isActive, true)
        )
      );

    return tokens;
  }),

  revokeToken: protectedProcedure
    .input(
      z.object({
        tokenId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Get current user
      const [currentUser] = await ctx.db
        .select({
          id: users.id,
          tenantId: users.tenantId,
        })
        .from(users)
        .where(eq(users.clerkId, ctx.userId))
        .limit(1);

      if (!currentUser) {
        throw new Error("User not found");
      }

      // Verify ownership and revoke
      const [token] = await ctx.db
        .select({ id: calendarAccessTokens.id })
        .from(calendarAccessTokens)
        .where(
          and(
            eq(calendarAccessTokens.id, input.tokenId),
            eq(calendarAccessTokens.vetId, currentUser.id),
            eq(calendarAccessTokens.tenantId, currentUser.tenantId)
          )
        )
        .limit(1);

      if (!token) {
        throw new Error("Token not found or access denied");
      }

      // Soft-delete by deactivating
      await ctx.db
        .update(calendarAccessTokens)
        .set({
          isActive: false,
          revokedAt: new Date(),
        })
        .where(eq(calendarAccessTokens.id, input.tokenId));

      return { success: true };
    }),

  getAccessAudit: protectedProcedure.query(async ({ ctx }) => {
    // Get current user
    const [currentUser] = await ctx.db
      .select({
        id: users.id,
        tenantId: users.tenantId,
      })
      .from(users)
      .where(eq(users.clerkId, ctx.userId))
      .limit(1);

    if (!currentUser) {
      throw new Error("User not found");
    }

    // Get recent audit entries for this vet's tokens
    const auditEntries = await ctx.db
      .select({
        id: calendarAccessAudit.id,
        accessedAt: calendarAccessAudit.accessedAt,
        ipAddress: calendarAccessAudit.ipAddress,
        eventCount: calendarAccessAudit.eventCount,
        httpStatus: calendarAccessAudit.httpStatus,
      })
      .from(calendarAccessAudit)
      .where(
        and(
          eq(calendarAccessAudit.tenantId, currentUser.tenantId),
          eq(calendarAccessAudit.veterinarianId, currentUser.id)
        )
      );

    return auditEntries;
  }),
});
