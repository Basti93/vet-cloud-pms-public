import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { createTRPCRouter, protectedProcedure } from "@/server/trpc";
import { tenants, vetSchedules, vetAbsences, users } from "@/lib/db/schema";
import { TRPCError } from "@trpc/server";
import { DEFAULT_OPENING_HOURS, type DaySchedule } from "@/lib/schedule-types";

const timeRangeSchema = z.object({
  startHour: z.number().int().min(0).max(23),
  startMin: z.number().int().min(0).max(59),
  endHour: z.number().int().min(0).max(23),
  endMin: z.number().int().min(0).max(59),
});

const dayScheduleSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  slots: z.array(timeRangeSchema),
});

export const scheduleRouter = createTRPCRouter({
  // ── Practice Opening Hours ──────────────────────────────────────────────────

  getPracticeHours: protectedProcedure
    .input(z.object({ tenantId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [tenant] = await ctx.db
        .select({ openingHours: tenants.openingHours })
        .from(tenants)
        .where(eq(tenants.id, input.tenantId))
        .limit(1);

      if (!tenant) throw new TRPCError({ code: "NOT_FOUND" });

      return (tenant.openingHours as DaySchedule[] | null) ?? DEFAULT_OPENING_HOURS;
    }),

  updatePracticeHours: protectedProcedure
    .input(z.object({
      tenantId: z.string().uuid(),
      hours: z.array(dayScheduleSchema).length(7),
    }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(tenants)
        .set({ openingHours: input.hours, updatedAt: new Date() })
        .where(eq(tenants.id, input.tenantId));
      return { success: true };
    }),

  // ── Vet Weekly Schedules ────────────────────────────────────────────────────

  getVetSchedules: protectedProcedure
    .input(z.object({ tenantId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const vets = await ctx.db
        .select({
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          title: users.title,
          role: users.role,
          slotDurationMin: users.slotDurationMin,
        })
        .from(users)
        .where(and(eq(users.tenantId, input.tenantId), eq(users.active, true)));

      const schedules = await ctx.db
        .select()
        .from(vetSchedules)
        .where(eq(vetSchedules.tenantId, input.tenantId));

      return vets.map((vet) => ({
        vet,
        // One entry per day that has been explicitly saved; missing days = inherit practice hours
        schedule: schedules
          .filter((s) => s.vetId === vet.id)
          .map((s) => ({ dayOfWeek: s.dayOfWeek, slots: s.slots as DaySchedule["slots"], notes: s.notes })),
      }));
    }),

  upsertVetDaySchedule: protectedProcedure
    .input(z.object({
      tenantId: z.string().uuid(),
      vetId: z.string().uuid(),
      dayOfWeek: z.number().int().min(0).max(6),
      slots: z.array(timeRangeSchema),
      notes: z.string().max(255).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const [existing] = await ctx.db
        .select({ id: vetSchedules.id })
        .from(vetSchedules)
        .where(
          and(
            eq(vetSchedules.tenantId, input.tenantId),
            eq(vetSchedules.vetId, input.vetId),
            eq(vetSchedules.dayOfWeek, input.dayOfWeek)
          )
        )
        .limit(1);

      if (existing) {
        await ctx.db
          .update(vetSchedules)
          .set({ slots: input.slots, notes: input.notes ?? null, updatedAt: new Date() })
          .where(eq(vetSchedules.id, existing.id));
      } else {
        await ctx.db.insert(vetSchedules).values({
          tenantId: input.tenantId,
          vetId: input.vetId,
          dayOfWeek: input.dayOfWeek,
          slots: input.slots,
          notes: input.notes ?? null,
        });
      }
      return { success: true };
    }),

  updateVetSlotDuration: protectedProcedure
    .input(z.object({
      tenantId: z.string().uuid(),
      vetId: z.string().uuid(),
      slotDurationMin: z.number().int().min(5).max(480),
    }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(users)
        .set({ slotDurationMin: input.slotDurationMin, updatedAt: new Date() })
        .where(and(eq(users.id, input.vetId), eq(users.tenantId, input.tenantId)));
      return { success: true };
    }),

  // ── Absences ────────────────────────────────────────────────────────────────

  getAbsences: protectedProcedure
    .input(z.object({
      tenantId: z.string().uuid(),
      vetId: z.string().uuid().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const conditions = [eq(vetAbsences.tenantId, input.tenantId)];
      if (input.vetId) conditions.push(eq(vetAbsences.vetId, input.vetId));

      const absences = await ctx.db
        .select({
          id: vetAbsences.id,
          vetId: vetAbsences.vetId,
          startDate: vetAbsences.startDate,
          endDate: vetAbsences.endDate,
          type: vetAbsences.type,
          note: vetAbsences.note,
          vet: {
            firstName: users.firstName,
            lastName: users.lastName,
            title: users.title,
          },
        })
        .from(vetAbsences)
        .innerJoin(users, eq(vetAbsences.vetId, users.id))
        .where(and(...conditions))
        .orderBy(vetAbsences.startDate);

      // Only return from today onwards
      const todayStr = new Date().toISOString().slice(0, 10);
      return absences.filter((a) => a.endDate >= todayStr);
    }),

  createAbsence: protectedProcedure
    .input(z.object({
      tenantId: z.string().uuid(),
      vetId: z.string().uuid(),
      startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      type: z.enum(["vacation", "sick", "other"]),
      note: z.string().max(500).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (input.endDate < input.startDate) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Enddatum darf nicht vor Startdatum liegen" });
      }
      const [created] = await ctx.db
        .insert(vetAbsences)
        .values({
          tenantId: input.tenantId,
          vetId: input.vetId,
          startDate: input.startDate,
          endDate: input.endDate,
          type: input.type,
          note: input.note ?? null,
        })
        .returning({ id: vetAbsences.id });
      return created;
    }),

  deleteAbsence: protectedProcedure
    .input(z.object({
      tenantId: z.string().uuid(),
      absenceId: z.string().uuid(),
    }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .delete(vetAbsences)
        .where(and(eq(vetAbsences.id, input.absenceId), eq(vetAbsences.tenantId, input.tenantId)));
      return { success: true };
    }),
});
