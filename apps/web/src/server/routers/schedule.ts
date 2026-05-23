import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { createTRPCRouter, tenantProcedure } from "@/server/trpc";
import { tenants, vetSchedules, vetAbsences, users, userRoles, roles } from "@/lib/db/schema";
import { TRPCError } from "@trpc/server";
import { DEFAULT_OPENING_HOURS, normalizeWeekSchedule, type DaySchedule } from "@/lib/schedule-types";
import { ROLE_CODES } from "@/lib/auth/roles";
import { auditedMutation } from "@/server/trpc/audited-mutation";

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

const specialOpeningHoursSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1).max(120),
  startsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  rows: z.array(z.object({
    days: z.string().min(1).max(80),
    time: z.string().min(1).max(80),
  })).min(1).max(14),
  note: z.string().max(500).optional(),
});

type SpecialOpeningHours = z.infer<typeof specialOpeningHoursSchema>;

function normalizeSpecialOpeningHours(value: unknown): SpecialOpeningHours[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry): SpecialOpeningHours[] => {
    const parsed = specialOpeningHoursSchema.safeParse(entry);
    return parsed.success ? [parsed.data] : [];
  });
}

export const scheduleRouter = createTRPCRouter({
  // ── Practice Consultation Hours ─────────────────────────────────────────────

  getConsultationHours: tenantProcedure
    .input(z.object({ tenantId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [tenant] = await ctx.db
        .select({ consultationHours: tenants.consultationHours })
        .from(tenants)
        .where(eq(tenants.id, input.tenantId))
        .limit(1);

      if (!tenant) throw new TRPCError({ code: "NOT_FOUND" });

      return normalizeWeekSchedule(tenant.consultationHours as DaySchedule[] | null, {
        fallback: DEFAULT_OPENING_HOURS,
      });
    }),

  updateConsultationHours: auditedMutation({
    entity: "tenant_consultation_schedule",
    event: "schedule.consultation_hours_updated",
    action: "config_change",
    summary: "Practice consultation hours updated",
    entityId: (_result, input) => (input as { tenantId: string }).tenantId,
    changes: (_result, input) => ({ daysConfigured: (input as { hours: unknown[] }).hours.length }),
  })
    .input(z.object({
      tenantId: z.string().uuid(),
      hours: z.array(dayScheduleSchema).min(0).max(7),
    }))
    .mutation(async ({ ctx, input }) => {
      const normalizedHours = normalizeWeekSchedule(input.hours);

      await ctx.db
        .update(tenants)
        .set({ consultationHours: normalizedHours, updatedAt: new Date() })
        .where(eq(tenants.id, input.tenantId));

      return { success: true };
    }),

  // ── Practice Opening Hours ──────────────────────────────────────────────────

  getPracticeHours: tenantProcedure
    .input(z.object({ tenantId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [tenant] = await ctx.db
        .select({ openingHours: tenants.openingHours })
        .from(tenants)
        .where(eq(tenants.id, input.tenantId))
        .limit(1);

      if (!tenant) throw new TRPCError({ code: "NOT_FOUND" });

      return normalizeWeekSchedule(tenant.openingHours as DaySchedule[] | null, {
        fallback: DEFAULT_OPENING_HOURS,
      });
    }),

  updatePracticeHours: auditedMutation({
    entity: "tenant_schedule",
    event: "schedule.practice_hours_updated",
    action: "config_change",
    summary: "Practice opening hours updated",
    entityId: (_result, input) => (input as { tenantId: string }).tenantId,
    changes: (_result, input) => ({ daysConfigured: (input as { hours: unknown[] }).hours.length }),
  })
    .input(z.object({
      tenantId: z.string().uuid(),
      hours: z.array(dayScheduleSchema).min(0).max(7),
    }))
    .mutation(async ({ ctx, input }) => {
      const normalizedHours = normalizeWeekSchedule(input.hours);

      await ctx.db
        .update(tenants)
        .set({ openingHours: normalizedHours, updatedAt: new Date() })
        .where(eq(tenants.id, input.tenantId));

      return { success: true };
    }),

  // ── Practice Special Opening Hours ─────────────────────────────────────────

  getSpecialOpeningHours: tenantProcedure
    .input(z.object({ tenantId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [tenant] = await ctx.db
        .select({ specialOpeningHours: tenants.specialOpeningHours })
        .from(tenants)
        .where(eq(tenants.id, input.tenantId))
        .limit(1);

      if (!tenant) throw new TRPCError({ code: "NOT_FOUND" });

      return normalizeSpecialOpeningHours(tenant.specialOpeningHours);
    }),

  updateSpecialOpeningHours: auditedMutation({
    entity: "tenant_special_hours",
    event: "schedule.special_hours_updated",
    action: "config_change",
    summary: "Practice special opening hours updated",
    entityId: (_result, input) => (input as { tenantId: string }).tenantId,
    changes: (_result, input) => ({ entriesConfigured: (input as { entries: unknown[] }).entries.length }),
  })
    .input(z.object({
      tenantId: z.string().uuid(),
      entries: z.array(specialOpeningHoursSchema).max(20),
    }))
    .mutation(async ({ ctx, input }) => {
      for (const entry of input.entries) {
        if (entry.startsOn && entry.endsOn && entry.endsOn < entry.startsOn) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Enddatum darf nicht vor Startdatum liegen" });
        }
      }

      await ctx.db
        .update(tenants)
        .set({ specialOpeningHours: input.entries, updatedAt: new Date() })
        .where(eq(tenants.id, input.tenantId));

      return { success: true };
    }),

  // ── Vet Weekly Schedules ────────────────────────────────────────────────────

  getVetSchedules: tenantProcedure
    .input(z.object({ tenantId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const vets = await ctx.db
        .select({
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          title: users.title,
          slotDurationMin: users.slotDurationMin,
        })
        .from(users)
        .innerJoin(userRoles, eq(userRoles.userId, users.id))
        .innerJoin(roles, eq(roles.id, userRoles.roleId))
        .where(
          and(
            eq(users.tenantId, input.tenantId),
            eq(users.active, true),
            eq(roles.code, ROLE_CODES.VET)
          )
        );

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

  upsertVetDaySchedule: auditedMutation({
    entity: "vet_schedule",
    event: "schedule.vet_day_upserted",
    action: "config_change",
    summary: "Vet day schedule updated",
    entityId: (result, input) =>
      (result as { scheduleId?: string }).scheduleId ??
      `${(input as { vetId: string }).vetId}:${(input as { dayOfWeek: number }).dayOfWeek}`,
    changes: (_result, input) => {
      const data = input as { vetId: string; dayOfWeek: number; slots: unknown[] };
      return {
        vetId: data.vetId,
        dayOfWeek: data.dayOfWeek,
        slotsCount: data.slots.length,
      };
    },
  })
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

      return { success: true, scheduleId: existing?.id };
    }),

  updateVetSlotDuration: auditedMutation({
    entity: "vet",
    event: "schedule.slot_duration_updated",
    action: "config_change",
    summary: "Vet slot duration updated",
    entityId: (_result, input) => (input as { vetId: string }).vetId,
    changes: (_result, input) => ({
      slotDurationMin: (input as { slotDurationMin: number }).slotDurationMin,
    }),
  })
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

  getAbsences: tenantProcedure
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

  createAbsence: auditedMutation({
    entity: "vet_absence",
    event: "schedule.absence_created",
    action: "create",
    summary: "Vet absence created",
    entityId: (result) => (result as { id: string }).id,
    changes: (_result, input) => {
      const data = input as {
        vetId: string;
        startDate: string;
        endDate: string;
        type: string;
      };
      return {
        vetId: data.vetId,
        startDate: data.startDate,
        endDate: data.endDate,
        type: data.type,
      };
    },
  })
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

  deleteAbsence: auditedMutation({
    entity: "vet_absence",
    event: "schedule.absence_deleted",
    action: "delete",
    summary: "Vet absence deleted",
    entityId: (_result, input) => (input as { absenceId: string }).absenceId,
    changes: () => ({ deleted: true }),
  })
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
