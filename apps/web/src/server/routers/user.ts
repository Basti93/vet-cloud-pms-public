import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { createTRPCRouter, protectedProcedure } from "@/server/trpc";
import { users, vetSchedules, vetAbsences } from "@/lib/db/schema";
import { TRPCError } from "@trpc/server";
import { writeAuditLog } from "@/server/audit";

export const userRouter = createTRPCRouter({
  /**
   * Get current user's preferences (locale, theme, etc.)
   * Protected: Auth required
   *
   * Loads all preferences at once. Called once on app initialization.
   */
  getPreferences: protectedProcedure.query(async ({ ctx }) => {
    const [user] = await ctx.db
      .select({
        locale: users.locale,
      })
      .from(users)
      .where(eq(users.clerkId, ctx.userId));

    if (!user) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "User not found",
      });
    }

    return {
      locale: (user.locale as "de" | "en") || "de",
    };
  }),

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
      try {
        // Get user's database ID by clerkId
        const [user] = await ctx.db
          .select({ id: users.id })
          .from(users)
          .where(eq(users.clerkId, ctx.userId));

        if (!user) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "User not found",
          });
        }

        const [updatedUser] = await ctx.db
          .update(users)
          .set({ locale: input.locale })
          .where(eq(users.id, user.id))
          .returning();

        await writeAuditLog(ctx, {
          tenantId: updatedUser!.tenantId,
          action: "config_change",
          entity: { type: "user", id: updatedUser!.id },
          event: "user.locale_updated",
          summary: "User locale updated",
          changes: { locale: input.locale },
        });

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
    const [user] = await ctx.db
      .select({ locale: users.locale })
      .from(users)
      .where(eq(users.clerkId, ctx.userId));

    if (!user) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "User not found",
      });
    }

    return { locale: user.locale };
  }),

  /**
   * Get current user's vet schedule (weekly availability)
   * Protected: Auth required
   */
  getVetSchedule: protectedProcedure.query(async ({ ctx }) => {
    // Get user's database ID by clerkId
    const [user] = await ctx.db
      .select({ id: users.id, tenantId: users.tenantId })
      .from(users)
      .where(eq(users.clerkId, ctx.userId));

    if (!user) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "User not found",
      });
    }

    const schedules = await ctx.db
      .select()
      .from(vetSchedules)
      .where(
        and(
          eq(vetSchedules.vetId, user.id),
          eq(vetSchedules.tenantId, user.tenantId)
        )
      );

    return schedules;
  }),

  /**
   * Update current user's vet schedule for a specific day
   * Protected: Auth required
   */
  updateVetScheduleDay: protectedProcedure
    .input(
      z.object({
        dayOfWeek: z.number().min(0).max(6),
        slots: z.array(
          z.object({
            startHour: z.number(),
            startMin: z.number(),
            endHour: z.number(),
            endMin: z.number(),
          })
        ),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Get user's database ID by clerkId
      const [user] = await ctx.db
        .select({ id: users.id, tenantId: users.tenantId })
        .from(users)
        .where(eq(users.clerkId, ctx.userId));

      if (!user) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User not found",
        });
      }

      // Try to update existing schedule, or insert if not exists
      const [existing] = await ctx.db
        .select()
        .from(vetSchedules)
        .where(
          and(
            eq(vetSchedules.vetId, user.id),
            eq(vetSchedules.dayOfWeek, input.dayOfWeek),
            eq(vetSchedules.tenantId, user.tenantId)
          )
        );

      try {
        if (existing) {
          await ctx.db
            .update(vetSchedules)
            .set({
              slots: input.slots,
              notes: input.notes || null,
            })
            .where(eq(vetSchedules.id, existing.id))
            .returning();
        } else {
          await ctx.db.insert(vetSchedules).values({
            vetId: user.id,
            tenantId: user.tenantId,
            dayOfWeek: input.dayOfWeek,
            slots: input.slots,
            notes: input.notes || null,
          });
        }

        await writeAuditLog(ctx, {
          tenantId: user.tenantId,
          action: "config_change",
          entity: { type: "vet_schedule", id: existing?.id ?? `${user.id}:${input.dayOfWeek}` },
          event: "user.vet_schedule_day_updated",
          summary: "Own vet schedule day updated",
          changes: { dayOfWeek: input.dayOfWeek, slotsCount: input.slots.length },
        });

        return { success: true };
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error("updateVetScheduleDay error:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Database error: ${errorMessage}`,
        });
      }
    }),

  /**
   * Get current user's absences (vacation, sick leave, etc.)
   * Protected: Auth required
   */
  getVetAbsences: protectedProcedure.query(async ({ ctx }) => {
    // Get user's database ID by clerkId
    const [user] = await ctx.db
      .select({ id: users.id, tenantId: users.tenantId })
      .from(users)
      .where(eq(users.clerkId, ctx.userId));

    if (!user) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "User not found",
      });
    }

    const absences = await ctx.db
      .select()
      .from(vetAbsences)
      .where(
        and(
          eq(vetAbsences.vetId, user.id),
          eq(vetAbsences.tenantId, user.tenantId)
        )
      );

    return absences;
  }),

  /**
   * Add an absence period for current user
   * Protected: Auth required
   */
  addVetAbsence: protectedProcedure
    .input(
      z.object({
        startDate: z.string(), // ISO date format
        endDate: z.string(), // ISO date format
        type: z.enum(["vacation", "sick", "other"]),
        note: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Get user's database ID by clerkId
      const [user] = await ctx.db
        .select({ id: users.id, tenantId: users.tenantId })
        .from(users)
        .where(eq(users.clerkId, ctx.userId));

      if (!user) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User not found",
        });
      }

      await ctx.db.insert(vetAbsences).values({
        vetId: user.id,
        tenantId: user.tenantId,
        startDate: input.startDate,
        endDate: input.endDate,
        type: input.type,
        note: input.note || null,
      });

      await writeAuditLog(ctx, {
        tenantId: user.tenantId,
        action: "create",
        entity: { type: "vet_absence", id: `${user.id}:${input.startDate}:${input.endDate}` },
        event: "user.vet_absence_added",
        summary: "Own absence added",
        changes: {
          startDate: input.startDate,
          endDate: input.endDate,
          type: input.type,
        },
      });

      return { success: true };
    }),

  /**
   * Remove an absence period
   * Protected: Auth required
   */
  removeVetAbsence: protectedProcedure
    .input(
      z.object({
        absenceId: z.string().uuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Get user's database ID by clerkId
      const [user] = await ctx.db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.clerkId, ctx.userId));

      if (!user) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User not found",
        });
      }

      // Verify the absence belongs to the current user
      const [absence] = await ctx.db
        .select()
        .from(vetAbsences)
        .where(eq(vetAbsences.id, input.absenceId));

      if (!absence || absence.vetId !== user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Cannot delete this absence",
        });
      }

      await ctx.db.delete(vetAbsences).where(eq(vetAbsences.id, input.absenceId));

      await writeAuditLog(ctx, {
        tenantId: absence.tenantId,
        action: "delete",
        entity: { type: "vet_absence", id: input.absenceId },
        event: "user.vet_absence_removed",
        summary: "Own absence removed",
        changes: { deleted: true },
      });

      return { success: true };
    }),

  /**
   * Update current user's slot duration (Terminminimaldauer)
   * Protected: Auth required
   */
  updateSlotDuration: protectedProcedure
    .input(
      z.object({
        slotDurationMin: z.number().min(5).max(480),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const [updatedUser] = await ctx.db
          .update(users)
          .set({ slotDurationMin: input.slotDurationMin })
          .where(eq(users.clerkId, ctx.userId))
          .returning();

        if (!updatedUser) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "User not found",
          });
        }

        await writeAuditLog(ctx, {
          tenantId: updatedUser.tenantId,
          action: "config_change",
          entity: { type: "user", id: updatedUser.id },
          event: "user.slot_duration_updated",
          summary: "Own slot duration updated",
          changes: { slotDurationMin: input.slotDurationMin },
        });

        return updatedUser;
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update slot duration",
        });
      }
    }),
});
