import { and, eq, gt, gte, isNull, lt, lte, notInArray, or, count } from "drizzle-orm";
import type { Database } from "@/lib/db/client";
import {
  appointmentHolds,
  appointments,
  roles,
  tenants,
  users,
  userRoles,
  vetAbsences,
  vetSchedules,
} from "@/lib/db/schema";
import { DEFAULT_OPENING_HOURS, type DaySchedule, type TimeRange } from "@/lib/schedule-types";
import {
  filterAvailableSlots,
  generateSlotsFromRanges,
  selectVetByFairDistribution,
  type BookingSlot,
} from "@/server/booking-core";
import { ROLE_CODES } from "@/lib/auth/roles";

export interface GetAvailableSlotsParams {
  tenantId: string;
  vetId?: string;
  date: Date;
  slotDurationMin?: number;
}

export interface SelectVetParams {
  tenantId: string;
  startTime?: Date;
  endTime?: Date;
}

export interface ReserveSlotParams {
  tenantId: string;
  vetId?: string;
  slotStart: Date;
  durationMin: number;
  browserSessionId: string;
  holdTtlMin?: number;
}

export interface CheckSlotAvailabilityParams {
  tenantId: string;
  vetId?: string;
  slotDatetime: Date;
  durationMin?: number;
}

export interface VetAvailability {
  id: string;
  title: string | null;
  firstName: string | null;
  lastName: string | null;
  hasAvailableSlots: boolean;
}

export interface ScheduleService {
  getVetSlotsForDay(tenantId: string, vetId: string, date: Date): Promise<BookingSlot[]>;
  getAvailableSlots(params: GetAvailableSlotsParams): Promise<BookingSlot[]>;
  selectVet(params: SelectVetParams): Promise<{
    id: string;
    title: string | null;
    firstName: string | null;
    lastName: string | null;
    appointmentCount: number;
  }>;
  reserveSlot(params: ReserveSlotParams): Promise<{ holdToken: string; expiresAt: Date }>;
  checkSlotAvailability(
    params: CheckSlotAvailabilityParams
  ): Promise<{ available: boolean; reason?: "held" | "booked" }>;
  getVetAvailability(tenantId: string): Promise<VetAvailability[]>;
}

export function createScheduleService(db: Database): ScheduleService {
  return {
    async getVetSlotsForDay(tenantId, vetId, date) {
      const [tenant] = await db
        .select({
          consultationHours: tenants.consultationHours,
          openingHours: tenants.openingHours,
          timezone: tenants.timezone,
        })
        .from(tenants)
        .where(eq(tenants.id, tenantId))
        .limit(1);

      const [vet] = await db
        .select({ slotDurationMin: users.slotDurationMin })
        .from(users)
        .where(eq(users.id, vetId))
        .limit(1);

      const timezone = tenant?.timezone ?? "Europe/Berlin";
      const slotDurationMin = vet?.slotDurationMin ?? 30;
      const localDateStr = date.toLocaleDateString("sv", { timeZone: timezone });
      const localDate = new Date(`${localDateStr}T12:00:00Z`);
      const dayOfWeek = localDate.getUTCDay();

      const [absence] = await db
        .select({ id: vetAbsences.id })
        .from(vetAbsences)
        .where(
          and(
            eq(vetAbsences.tenantId, tenantId),
            eq(vetAbsences.vetId, vetId),
            lte(vetAbsences.startDate, localDateStr),
            gte(vetAbsences.endDate, localDateStr)
          )
        )
        .limit(1);

      if (absence) return [];

      const [vetSchedule] = await db
        .select({ slots: vetSchedules.slots })
        .from(vetSchedules)
        .where(
          and(
            eq(vetSchedules.tenantId, tenantId),
            eq(vetSchedules.vetId, vetId),
            eq(vetSchedules.dayOfWeek, dayOfWeek)
          )
        )
        .limit(1);

      if (vetSchedule) {
        return generateSlotsFromRanges(
          localDateStr,
          vetSchedule.slots as TimeRange[],
          timezone,
          slotDurationMin
        );
      }

      const bookableHours =
        (tenant?.consultationHours as DaySchedule[] | null) ??
        (tenant?.openingHours as DaySchedule[] | null) ??
        DEFAULT_OPENING_HOURS;
      const practiceDay = bookableHours.find((h) => h.dayOfWeek === dayOfWeek);

      return generateSlotsFromRanges(
        localDateStr,
        practiceDay?.slots ?? [],
        timezone,
        slotDurationMin
      );
    },

    async getAvailableSlots(params) {
      let allSlots: BookingSlot[];
      if (params.vetId) {
        allSlots = await this.getVetSlotsForDay(params.tenantId, params.vetId, params.date);
      } else {
        const [tenant] = await db
          .select({
            consultationHours: tenants.consultationHours,
            openingHours: tenants.openingHours,
            timezone: tenants.timezone,
          })
          .from(tenants)
          .where(eq(tenants.id, params.tenantId))
          .limit(1);
        const timezone = tenant?.timezone ?? "Europe/Berlin";
        const localDateStr = params.date.toLocaleDateString("sv", { timeZone: timezone });
        const localDate = new Date(`${localDateStr}T12:00:00Z`);
        const dayOfWeek = localDate.getUTCDay();
        const bookableHours =
          (tenant?.consultationHours as DaySchedule[] | null) ??
          (tenant?.openingHours as DaySchedule[] | null) ??
          DEFAULT_OPENING_HOURS;
        const practiceDay = bookableHours.find((h) => h.dayOfWeek === dayOfWeek);
        allSlots = generateSlotsFromRanges(
          localDateStr,
          practiceDay?.slots ?? [],
          timezone,
          params.slotDurationMin ?? 30
        );
      }

      if (allSlots.length === 0) return [];

      const rangeStart = allSlots[0].start;
      const rangeEnd = allSlots[allSlots.length - 1].end;
      const bookedConditions = [
        eq(appointments.tenantId, params.tenantId),
        lte(appointments.startTime, rangeEnd),
        gte(appointments.endTime, rangeStart),
        notInArray(appointments.status, ["cancelled"]),
      ];
      if (params.vetId) {
        bookedConditions.push(eq(appointments.vetId, params.vetId));
      }

      const booked = await db
        .select({ startTime: appointments.startTime, endTime: appointments.endTime })
        .from(appointments)
        .where(and(...bookedConditions));

      const holdVetCondition = params.vetId
        ? or(isNull(appointmentHolds.vetId), eq(appointmentHolds.vetId, params.vetId))
        : undefined;

      const holds = await db
        .select({ slotDatetime: appointmentHolds.slotDatetime })
        .from(appointmentHolds)
        .where(
          and(
            eq(appointmentHolds.tenantId, params.tenantId),
            gte(appointmentHolds.slotDatetime, rangeStart),
            lte(appointmentHolds.slotDatetime, rangeEnd),
            gte(appointmentHolds.expiresAt, new Date()),
            ...(holdVetCondition ? [holdVetCondition] : [])
          )
        );

      return filterAvailableSlots(allSlots, booked, holds);
    },

    async selectVet(params) {
      const vets = await db
        .select({
          id: users.id,
          title: users.title,
          firstName: users.firstName,
          lastName: users.lastName,
        })
        .from(users)
        .innerJoin(userRoles, eq(userRoles.userId, users.id))
        .innerJoin(roles, eq(roles.id, userRoles.roleId))
        .where(
          and(
            eq(users.tenantId, params.tenantId),
            eq(roles.code, ROLE_CODES.VET),
            eq(users.active, true)
          )
        );

      const vetWithCounts = await Promise.all(
        vets.map(async (vet) => {
          const baseConditions = [
            eq(appointments.tenantId, params.tenantId),
            eq(appointments.vetId, vet.id),
            eq(appointments.status, "scheduled"),
          ];
          const whereClause =
            params.startTime && params.endTime
              ? and(
                  ...baseConditions,
                  and(
                    lt(appointments.startTime, params.endTime),
                    gt(appointments.endTime, params.startTime)
                  )
                )
              : and(...baseConditions);
          const [result] = await db
            .select({ appointmentCount: count() })
            .from(appointments)
            .where(whereClause);
          return { ...vet, appointmentCount: result.appointmentCount || 0 };
        })
      );

      const suggestedVetId = selectVetByFairDistribution(vetWithCounts);
      return vetWithCounts.find((v) => v.id === suggestedVetId)!;
    },

    async reserveSlot(params) {
      const now = new Date();
      const slotEnd = new Date(params.slotStart.getTime() + params.durationMin * 60_000);

      await db
        .delete(appointmentHolds)
        .where(
          and(
            eq(appointmentHolds.tenantId, params.tenantId),
            eq(appointmentHolds.browserSessionId, params.browserSessionId)
          )
        );

      await db.delete(appointmentHolds).where(lt(appointmentHolds.expiresAt, now));

      const holdConflictBase = [
        eq(appointmentHolds.tenantId, params.tenantId),
        eq(appointmentHolds.slotDatetime, params.slotStart),
        gte(appointmentHolds.expiresAt, now),
      ];
      const holdVetConflict = params.vetId
        ? or(isNull(appointmentHolds.vetId), eq(appointmentHolds.vetId, params.vetId))
        : undefined;

      const [existingHold] = await db
        .select({ id: appointmentHolds.id })
        .from(appointmentHolds)
        .where(
          holdVetConflict
            ? and(...holdConflictBase, holdVetConflict)
            : and(...holdConflictBase)
        )
        .limit(1);

      if (existingHold) {
        throw new Error("slot_held");
      }

      const bookingConflictConditions = [
        eq(appointments.tenantId, params.tenantId),
        lt(appointments.startTime, slotEnd),
        gt(appointments.endTime, params.slotStart),
      ];
      if (params.vetId) {
        bookingConflictConditions.push(eq(appointments.vetId, params.vetId));
      }

      const [alreadyBooked] = await db
        .select({ id: appointments.id })
        .from(appointments)
        .where(and(...bookingConflictConditions))
        .limit(1);

      if (alreadyBooked) {
        throw new Error("slot_booked");
      }

      const { randomUUID } = await import("node:crypto");
      const sessionToken = randomUUID();
      const expiresAt = new Date(now.getTime() + (params.holdTtlMin ?? 15) * 60_000);

      const [hold] = await db
        .insert(appointmentHolds)
        .values({
          tenantId: params.tenantId,
          slotDatetime: params.slotStart,
          vetId: params.vetId ?? null,
          browserSessionId: params.browserSessionId,
          sessionToken,
          expiresAt,
        })
        .returning();

      return { holdToken: hold.sessionToken, expiresAt: hold.expiresAt };
    },

    async checkSlotAvailability(params) {
      const now = new Date();
      let slotDurationMin = params.durationMin ?? 30;
      if (params.vetId && params.durationMin === undefined) {
        const [vet] = await db
          .select({ slotDurationMin: users.slotDurationMin })
          .from(users)
          .where(eq(users.id, params.vetId))
          .limit(1);
        if (vet) slotDurationMin = vet.slotDurationMin;
      }

      const slotEnd = new Date(params.slotDatetime.getTime() + slotDurationMin * 60_000);
      const holdBase = [
        eq(appointmentHolds.tenantId, params.tenantId),
        eq(appointmentHolds.slotDatetime, params.slotDatetime),
        gte(appointmentHolds.expiresAt, now),
      ];
      const holdVet = params.vetId
        ? or(isNull(appointmentHolds.vetId), eq(appointmentHolds.vetId, params.vetId))
        : undefined;

      const [activeHold] = await db
        .select({ id: appointmentHolds.id })
        .from(appointmentHolds)
        .where(holdVet ? and(...holdBase, holdVet) : and(...holdBase))
        .limit(1);

      if (activeHold) return { available: false, reason: "held" };

      const bookingConditions = [
        eq(appointments.tenantId, params.tenantId),
        lt(appointments.startTime, slotEnd),
        gt(appointments.endTime, params.slotDatetime),
      ];
      if (params.vetId) bookingConditions.push(eq(appointments.vetId, params.vetId));

      const [booking] = await db
        .select({ id: appointments.id })
        .from(appointments)
        .where(and(...bookingConditions))
        .limit(1);

      return {
        available: !booking,
        reason: booking ? "booked" : undefined,
      };
    },

    async getVetAvailability(tenantId) {
      const vets = await db
        .select({
          id: users.id,
          title: users.title,
          firstName: users.firstName,
          lastName: users.lastName,
        })
        .from(users)
        .innerJoin(userRoles, eq(userRoles.userId, users.id))
        .innerJoin(roles, eq(roles.id, userRoles.roleId))
        .where(
          and(
            eq(users.tenantId, tenantId),
            eq(roles.code, ROLE_CODES.VET),
            eq(users.active, true)
          )
        );

      const nextDays: Date[] = [];
      const cursor = new Date();
      cursor.setDate(cursor.getDate() + 1);
      for (let i = 0; i < 28; i++) {
        nextDays.push(new Date(cursor));
        cursor.setDate(cursor.getDate() + 1);
      }

      return Promise.all(
        vets.map(async (vet) => {
          for (const day of nextDays) {
            const availableSlots = await this.getAvailableSlots({
              tenantId,
              vetId: vet.id,
              date: day,
            });
            if (availableSlots.length > 0) {
              return { ...vet, hasAvailableSlots: true };
            }
          }

          return { ...vet, hasAvailableSlots: false };
        })
      );
    },
  };
}
