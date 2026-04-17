import { z } from "zod";
import { eq, and, gte, lte, desc } from "drizzle-orm";
import { createTRPCRouter, protectedProcedure } from "@/server/trpc";
import { appointments, users } from "@/lib/db/schema";
import { TRPCError } from "@trpc/server";

export const appointmentsRouter = createTRPCRouter({
  // List appointments for a date range
  list: protectedProcedure
    .input(
      z.object({
        tenantId: z.string().uuid(),
        from: z.date().optional(),
        to: z.date().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const conditions = [eq(appointments.tenantId, input.tenantId)];

      if (input.from) {
        conditions.push(gte(appointments.startTime, input.from));
      }
      if (input.to) {
        conditions.push(lte(appointments.endTime, input.to));
      }

      return ctx.db
        .select()
        .from(appointments)
        .where(and(...conditions))
        .orderBy(appointments.startTime);
    }),

  // Get single appointment
  byId: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const result = await ctx.db
        .select()
        .from(appointments)
        .where(eq(appointments.id, input.id))
        .limit(1);

      if (!result[0]) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Termin nicht gefunden" });
      }

      return result[0];
    }),

  // Create appointment
  create: protectedProcedure
    .input(
      z.object({
        tenantId: z.string().uuid(),
        patientId: z.string().uuid(),
        vetId: z.string().uuid(),
        startTime: z.date(),
        endTime: z.date(),
        title: z.string().min(1).max(255),
        description: z.string().optional(),
        source: z
          .enum(["manual", "voice_ai", "online_booking", "import"])
          .default("manual"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [created] = await ctx.db
        .insert(appointments)
        .values({
          tenantId: input.tenantId,
          patientId: input.patientId,
          vetId: input.vetId,
          startTime: input.startTime,
          endTime: input.endTime,
          title: input.title,
          description: input.description,
          source: input.source,
          status: "scheduled",
        })
        .returning();

      return created;
    }),

  // Update status
  updateStatus: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        status: z.enum(["scheduled", "completed", "cancelled", "no-show"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(appointments)
        .set({ status: input.status, updatedAt: new Date() })
        .where(eq(appointments.id, input.id))
        .returning();

      if (!updated) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      return updated;
    }),

  // Delete
  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .delete(appointments)
        .where(eq(appointments.id, input.id));

      return { success: true };
    }),
});
