import { z } from "zod";
import { eq, and, gte, lte, lt, or, isNull } from "drizzle-orm";
import { createTRPCRouter, publicProcedure, publicBookingProcedure, protectedProcedure } from "@/server/trpc";
import { tenants, appointments, owners, patients, users, userRoles, roles, appointmentHolds, emailSettings, vetSchedules, vetAbsences } from "@/lib/db/schema";
import { TRPCError } from "@trpc/server";
import { sendConfirmationEmail, sendBookingNotificationEmail } from "@/lib/email/service";
import type { SendConfirmationEmailInput, SendBookingNotificationInput } from "@/lib/email/service";
import { DEFAULT_OPENING_HOURS, type DaySchedule, type TimeRange } from "@/lib/schedule-types";
import { getMainDomain } from "@/lib/env";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type * as schema from "@/lib/db/schema";
import { ROLE_CODES } from "@/lib/auth/roles";

// ── Slot generation ───────────────────────────────────────────────────────────

type Db = PostgresJsDatabase<typeof schema>;

/**
 * Convert a local date+time in a given IANA timezone to a UTC Date.
 * Uses Intl (built-in, no extra deps) and correctly handles DST.
 */
function zonedToUtc(localDateStr: string, hour: number, min: number, timezone: string): Date {
  const pad = (n: number) => String(n).padStart(2, '0');
  // Build a pseudo-UTC date using the local hour/min values
  const pseudo = new Date(`${localDateStr}T${pad(hour)}:${pad(min)}:00Z`);
  // What does that UTC instant look like in the target timezone?
  const inTz = new Date(
    pseudo.toLocaleString('sv', { timeZone: timezone }).replace(' ', 'T') + 'Z'
  );
  // Offset = difference between the two interpretations
  return new Date(pseudo.getTime() + (pseudo.getTime() - inTz.getTime()));
}

/** Generate booking slots across multiple time ranges using the practice timezone. */
function generateSlotsFromRanges(
  localDateStr: string,
  ranges: TimeRange[],
  timezone: string,
  slotDurationMin: number = 30
): { start: Date; end: Date }[] {
  const now = new Date();
  const slots: { start: Date; end: Date }[] = [];

  for (const range of ranges) {
    let totalMin = range.startHour * 60 + range.startMin;
    const endTotalMin = range.endHour * 60 + range.endMin;

    while (totalMin + slotDurationMin <= endTotalMin) {
      const start = zonedToUtc(localDateStr, Math.floor(totalMin / 60), totalMin % 60, timezone);
      const end = new Date(start.getTime() + slotDurationMin * 60_000);
      if (start > now) slots.push({ start, end });
      totalMin += slotDurationMin;
    }
  }
  return slots;
}

async function getVetSlotsForDay(
  db: Db,
  tenantId: string,
  vetId: string,
  date: Date
): Promise<{ start: Date; end: Date }[]> {
  // Fetch tenant timezone + opening hours, and vet's slot duration
  const [tenant] = await db
    .select({ openingHours: tenants.openingHours, timezone: tenants.timezone })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);

  const [vet] = await db
    .select({ slotDurationMin: users.slotDurationMin })
    .from(users)
    .where(eq(users.id, vetId))
    .limit(1);

  const timezone = tenant?.timezone ?? 'Europe/Berlin';
  const slotDurationMin = vet?.slotDurationMin ?? 30;

  // Compute date string and dayOfWeek in the practice's local timezone
  const localDateStr = date.toLocaleDateString('sv', { timeZone: timezone }); // YYYY-MM-DD
  const localDate = new Date(localDateStr + 'T12:00:00Z'); // noon UTC to avoid DST edge cases
  const dayOfWeek = localDate.getUTCDay();

  // 1. Check vet absence first
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

  // 2. Check vet's own schedule for this day
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
    return generateSlotsFromRanges(localDateStr, vetSchedule.slots as TimeRange[], timezone, slotDurationMin);
  }

  // 3. No vet schedule → fall back to practice opening hours
  const practiceDay = ((tenant?.openingHours as DaySchedule[] | null) ?? DEFAULT_OPENING_HOURS)
    .find((h) => h.dayOfWeek === dayOfWeek);

  return generateSlotsFromRanges(localDateStr, practiceDay?.slots ?? [], timezone, slotDurationMin);
}

// ── Router ────────────────────────────────────────────────────────────────────

export const bookingRouter = createTRPCRouter({
  /** Protected: List all online booking requests (for admin dashboard) */
  list: protectedProcedure
    .input(z.object({ tenantId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const bookings = await ctx.db
        .select({
          id: appointments.id,
          startTime: appointments.startTime,
          endTime: appointments.endTime,
          title: appointments.title,
          status: appointments.status,
          createdAt: appointments.createdAt,
          vetId: appointments.vetId,
          patient: {
            id: patients.id,
            name: patients.name,
            species: patients.species,
            breed: patients.breed,
          },
          owner: {
            id: owners.id,
            firstName: owners.firstName,
            lastName: owners.lastName,
            email: owners.email,
            phone: owners.phone,
          },
        })
        .from(appointments)
        .innerJoin(patients, eq(appointments.patientId, patients.id))
        .innerJoin(owners, eq(patients.ownerId, owners.id))
        .where(
          and(
            eq(appointments.tenantId, input.tenantId),
            eq(appointments.source, "online_booking")
          )
        );

      return bookings;
    }),

  /** Protected: Confirm a booking request (status = "confirmed" = confirmed by admin) */
  confirm: protectedProcedure
    .input(z.object({
      appointmentId: z.string().uuid(),
      tenantId: z.string().uuid(),
    }))
    .mutation(async ({ ctx, input }) => {
      const [appointment] = await ctx.db
        .update(appointments)
        .set({
          status: "confirmed", // Mark as confirmed/accepted by admin
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(appointments.id, input.appointmentId),
            eq(appointments.tenantId, input.tenantId),
            eq(appointments.source, "online_booking")
          )
        )
        .returning();

      if (!appointment) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Termin nicht gefunden" });
      }

      // Send confirmation email to patient owner
      try {
        // Fetch patient, owner, and practice details
        const [patientData] = await ctx.db
          .select({
            patientName: patients.name,
            patientSpecies: patients.species,
            ownerFirstName: owners.firstName,
            ownerEmail: owners.email,
          })
          .from(patients)
          .innerJoin(owners, eq(patients.ownerId, owners.id))
          .where(eq(patients.id, appointment.patientId))
          .limit(1);

        const [tenant] = await ctx.db
          .select({ name: tenants.name })
          .from(tenants)
          .where(eq(tenants.id, input.tenantId))
          .limit(1);

        // Fetch vet name if assigned
        const [vet] = await ctx.db
          .select({ firstName: users.firstName, lastName: users.lastName })
          .from(users)
          .where(eq(users.id, appointment.vetId))
          .limit(1);

        if (patientData && patientData.ownerEmail && tenant) {
          // Check if confirmation emails are enabled
          const [settings] = await ctx.db
            .select()
            .from(emailSettings)
            .where(eq(emailSettings.tenantId, input.tenantId))
            .limit(1);

          if (settings?.confirmationEmailEnabled !== false) {
            const startDate = new Date(appointment.startTime);
            const dateStr = startDate.toLocaleDateString("de-DE", {
              weekday: "long",
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
            });
            const timeStr = startDate.toLocaleTimeString("de-DE", {
              hour: "2-digit",
              minute: "2-digit",
            });
            const dateTimeStr = `${dateStr} um ${timeStr}`;

            const emailInput: SendConfirmationEmailInput = {
              to: patientData.ownerEmail,
              practiceName: tenant.name,
              ownerFirstName: patientData.ownerFirstName,
              patientName: patientData.patientName,
              patientSpecies: patientData.patientSpecies,
              appointmentDate: dateStr,
              appointmentTime: timeStr,
              appointmentDateTime: dateTimeStr,
              vetName: vet ? `${vet.firstName} ${vet.lastName}` : undefined,
            };

            await sendConfirmationEmail(emailInput);
          }
        }
      } catch (emailError) {
        // Log error but don't fail the booking confirmation
        console.error("Failed to send confirmation email:", emailError);
      }

      return { success: true, appointmentId: appointment.id };
    }),

  /** Protected: Reject a booking request (status = "cancelled") */
  reject: protectedProcedure
    .input(z.object({
      appointmentId: z.string().uuid(),
      tenantId: z.string().uuid(),
      reason: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const [appointment] = await ctx.db
        .update(appointments)
        .set({
          status: "cancelled",
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(appointments.id, input.appointmentId),
            eq(appointments.tenantId, input.tenantId),
            eq(appointments.source, "online_booking")
          )
        )
        .returning();

      if (!appointment) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Termin nicht gefunden" });
      }

      return { success: true, appointmentId: appointment.id };
    }),

  /** Public: Fetch clinic info by slug for the booking widget header */
  getClinic: publicProcedure
    .input(z.object({ slug: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const [tenant] = await ctx.db
        .select({
          id: tenants.id,
          name: tenants.name,
          slug: tenants.slug,
          email: tenants.email,
          phone: tenants.phone,
          address: tenants.address,
          city: tenants.city,
          postalCode: tenants.postalCode,
          tagline: tenants.tagline,
          themePreference: tenants.themePreference,
          typographyPreference: tenants.typographyPreference,
          websiteTemplate: tenants.websiteTemplate,
          monogram: tenants.monogram,
          allowedEmbeddingDomains: tenants.allowedEmbeddingDomains,
        })
        .from(tenants)
        .where(eq(tenants.slug, input.slug))
        .limit(1);

      if (!tenant) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Praxis nicht gefunden" });
      }

      // Check domain restrictions if configured
      const allowedDomains = (tenant.allowedEmbeddingDomains as string[] | null) || [];
      const mainDomainUrl = getMainDomain();
      const mainDomainHost = new URL(mainDomainUrl).hostname;

      if (allowedDomains.length > 0) {
        const referer = ctx.headers.get("referer");
        const origin = ctx.headers.get("origin");
        const requestDomain = referer || origin;

        if (requestDomain) {
          try {
            const url = new URL(requestDomain);
            const hostname = url.hostname;

            // Always allow main domain, plus any configured domains
            const allAllowedDomains = [...new Set([mainDomainHost, ...allowedDomains])];
            const isAllowed = allAllowedDomains.some(domain =>
              hostname === domain || hostname === `www.${domain}` || domain === `www.${hostname}`
            );

            if (!isAllowed) {
              throw new TRPCError({
                code: "FORBIDDEN",
                message: "Diese Domain ist nicht autorisiert, das Buchungs-Widget einzubinden"
              });
            }
          } catch (err) {
            if (err instanceof TRPCError) throw err;
          }
        }
      }

      return tenant;
    }),

  /** Public: Return available 30-min slots for a given tenant + calendar date (optionally filtered by vet) */
  getAvailableSlots: publicProcedure
    .input(
      z.object({
        tenantId: z.string().uuid(),
        date: z.date(),
        vetId: z.string().uuid().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const dayStart = new Date(input.date);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(input.date);
      dayEnd.setHours(23, 59, 59, 999);

      const conditions = [
        eq(appointments.tenantId, input.tenantId),
        gte(appointments.startTime, dayStart),
        lte(appointments.startTime, dayEnd),
      ];

      if (input.vetId) {
        conditions.push(eq(appointments.vetId, input.vetId));
      }

      const booked = await ctx.db
        .select({
          startTime: appointments.startTime,
          endTime: appointments.endTime,
        })
        .from(appointments)
        .where(and(...conditions));

      // Also filter out actively held slots (expires_at > now)
      const holdBaseConditions = [
        eq(appointmentHolds.tenantId, input.tenantId),
        gte(appointmentHolds.slotDatetime, dayStart),
        lte(appointmentHolds.slotDatetime, dayEnd),
        gte(appointmentHolds.expiresAt, new Date()),
      ];
      const holdVetCondition = input.vetId
        ? or(isNull(appointmentHolds.vetId), eq(appointmentHolds.vetId, input.vetId))
        : undefined;

      const holds = await ctx.db
        .select({ slotDatetime: appointmentHolds.slotDatetime })
        .from(appointmentHolds)
        .where(
          holdVetCondition
            ? and(...holdBaseConditions, holdVetCondition)
            : and(...holdBaseConditions)
        );

      // Use schedule-aware slot generation (requires vetId for per-vet hours)
      // If no vetId, fall back to practice hours only
      let allSlots: { start: Date; end: Date }[];
      if (input.vetId) {
        allSlots = await getVetSlotsForDay(ctx.db, input.tenantId, input.vetId, input.date);
      } else {
        // No vet selected: use practice opening hours (30min default, no per-vet duration)
        const [tenant] = await ctx.db
          .select({ openingHours: tenants.openingHours, timezone: tenants.timezone })
          .from(tenants)
          .where(eq(tenants.id, input.tenantId))
          .limit(1);
        const timezone = tenant?.timezone ?? 'Europe/Berlin';
        const localDateStr = input.date.toLocaleDateString('sv', { timeZone: timezone });
        const localDate = new Date(localDateStr + 'T12:00:00Z');
        const dayOfWeek = localDate.getUTCDay();
        const practiceDay = ((tenant?.openingHours as DaySchedule[] | null) ?? DEFAULT_OPENING_HOURS)
          .find((h) => h.dayOfWeek === dayOfWeek);
        allSlots = generateSlotsFromRanges(localDateStr, practiceDay?.slots ?? [], timezone, 30);
      }

      return allSlots
        .filter((slot) =>
          !booked.some(
            (a) =>
              new Date(a.startTime) < slot.end &&
              new Date(a.endTime) > slot.start
          ) &&
          !holds.some(
            (h) => new Date(h.slotDatetime).getTime() === slot.start.getTime()
          )
        )
        .map((s) => ({ start: s.start, end: s.end }));
    }),

  /** Public: Create owner + patient + appointment from booking widget */
  book: publicBookingProcedure
    .input(
      z.object({
        tenantId: z.string().uuid(),
        slotStart: z.date(),
        slotEnd: z.date(),
        reason: z.string().min(1).max(255),
        patient: z.object({
          name: z.string().min(1).max(100),
          species: z.string().min(1).max(50),
          breed: z.string().max(100).optional(),
        }),
        owner: z.object({
          firstName: z.string().min(1).max(100),
          lastName: z.string().min(1).max(100),
          email: z.string().email(),
          phone: z.string().min(3).max(20),
        }),
        vetId: z.string().uuid().optional(),
        browserSessionId: z.string().uuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify tenant exists + slot is still in the future
      if (input.slotStart <= new Date()) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Dieser Zeitslot liegt in der Vergangenheit" });
      }

      // Use provided vetId or pick first active user (vet/admin) for this tenant as appointment owner
      let vet: { id: string } | undefined;
      if (input.vetId) {
        const [selectedVet] = await ctx.db
          .select({ id: users.id })
          .from(users)
          .where(and(eq(users.id, input.vetId), eq(users.tenantId, input.tenantId), eq(users.active, true)))
          .limit(1);
        vet = selectedVet;
      } else {
        const [firstVet] = await ctx.db
          .select({ id: users.id })
          .from(users)
          .where(and(eq(users.tenantId, input.tenantId), eq(users.active, true)))
          .limit(1);
        vet = firstVet;
      }

      if (!vet) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Kein Tierarzt konfiguriert" });
      }

      // Check slot is still available (race-condition guard)
      // A conflict exists if any existing appointment overlaps: apptStart < slotEnd AND apptEnd > slotStart
      const conflict = await ctx.db
        .select({ id: appointments.id })
        .from(appointments)
        .where(
          and(
            eq(appointments.tenantId, input.tenantId),
            lte(appointments.startTime, input.slotEnd),
            gte(appointments.endTime, input.slotStart)
          )
        )
        .limit(1);

      if (conflict.length > 0) {
        throw new TRPCError({ code: "CONFLICT", message: "Dieser Termin ist leider nicht mehr frei" });
      }

      // Create owner
      const [owner] = await ctx.db
        .insert(owners)
        .values({
          tenantId: input.tenantId,
          firstName: input.owner.firstName,
          lastName: input.owner.lastName,
          email: input.owner.email,
          phone: input.owner.phone,
        })
        .returning();

      // Create patient
      const [patient] = await ctx.db
        .insert(patients)
        .values({
          tenantId: input.tenantId,
          ownerId: owner.id,
          name: input.patient.name,
          species: input.patient.species,
          breed: input.patient.breed ?? undefined,
        })
        .returning();

      // Create appointment
      const [appointment] = await ctx.db
        .insert(appointments)
        .values({
          tenantId: input.tenantId,
          patientId: patient.id,
          vetId: vet.id,
          startTime: input.slotStart,
          endTime: input.slotEnd,
          title: input.reason,
          source: "online_booking",
          status: "scheduled",
        })
        .returning();

      // Clean up all holds for this browser session (booking succeeded — DSGVO: delete session data)
      await ctx.db
        .delete(appointmentHolds)
        .where(
          and(
            eq(appointmentHolds.tenantId, input.tenantId),
            eq(appointmentHolds.browserSessionId, input.browserSessionId)
          )
        );

      // Send booking notification email to practice owner (fire and forget, don't block response)
      try {
        const [tenantData] = await ctx.db
          .select({
            tenantName: tenants.name,
            tenantEmail: tenants.email,
          })
          .from(tenants)
          .where(eq(tenants.id, input.tenantId))
          .limit(1);

        if (tenantData && tenantData.tenantEmail) {
          // Check if booking notifications are enabled
          const [settings] = await ctx.db
            .select()
            .from(emailSettings)
            .where(eq(emailSettings.tenantId, input.tenantId))
            .limit(1);

          if (settings?.bookingNotificationEnabled !== false) {
            const startDate = new Date(appointment.startTime);
            const dateStr = startDate.toLocaleDateString("de-DE", {
              weekday: "long",
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
            });
            const timeStr = startDate.toLocaleTimeString("de-DE", {
              hour: "2-digit",
              minute: "2-digit",
            });
            const dateTimeStr = `${dateStr} um ${timeStr}`;

            // Fetch vet name
            let vetName = "Unzugewiesen";
            if (vet?.id) {
              const [vetData] = await ctx.db
                .select({ firstName: users.firstName, lastName: users.lastName })
                .from(users)
                .where(eq(users.id, vet.id))
                .limit(1);
              if (vetData) {
                vetName = `${vetData.firstName} ${vetData.lastName}`;
              }
            }

            const bookingNotifInput: SendBookingNotificationInput = {
              to: tenantData.tenantEmail,
              practiceName: tenantData.tenantName,
              ownerFirstName: owner.firstName,
              ownerLastName: owner.lastName,
              patientName: patient.name,
              patientSpecies: patient.species,
              appointmentDate: dateStr,
              appointmentDateTime: dateTimeStr,
              vetName,
            };

            await sendBookingNotificationEmail(bookingNotifInput);
          }
        }
      } catch (emailError) {
        // Log error but don't fail the booking
        console.error("Failed to send booking notification email:", emailError);
      }

      return {
        appointmentId: appointment.id,
        startTime: appointment.startTime,
        endTime: appointment.endTime,
        patientName: patient.name,
        ownerName: `${owner.firstName} ${owner.lastName}`,
        ownerEmail: owner.email,
      };
    }),

  // ─── Slot-Hold Procedures ──────────────────────────────────────────────────

  /** Public: Reserve a slot for 15 minutes — returns holdToken */
  holdSlot: publicBookingProcedure
    .input(
      z.object({
        tenantId: z.string().uuid(),
        slotDatetime: z.date(),
        vetId: z.string().uuid().optional(),
        browserSessionId: z.string().uuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const now = new Date();

      // Fetch vet's slot duration if specified, otherwise default to 30 min
      let slotDurationMin = 30;
      if (input.vetId) {
        const [vet] = await ctx.db
          .select({ slotDurationMin: users.slotDurationMin })
          .from(users)
          .where(eq(users.id, input.vetId))
          .limit(1);
        if (vet) slotDurationMin = vet.slotDurationMin;
      }

      const slotEnd = new Date(input.slotDatetime.getTime() + slotDurationMin * 60_000);

      // 1. Delete old holds from same browser session (only 1 active hold per user)
      await ctx.db
        .delete(appointmentHolds)
        .where(
          and(
            eq(appointmentHolds.tenantId, input.tenantId),
            eq(appointmentHolds.browserSessionId, input.browserSessionId)
          )
        );

      // 2. Cleanup expired holds (opportunistic — no separate job needed)
      await ctx.db
        .delete(appointmentHolds)
        .where(lt(appointmentHolds.expiresAt, now));

      // 2. Check for existing active hold on same slot (+/- vet)
      const holdConflictBase = [
        eq(appointmentHolds.tenantId, input.tenantId),
        eq(appointmentHolds.slotDatetime, input.slotDatetime),
        gte(appointmentHolds.expiresAt, now),
      ];
      const holdVetConflict = input.vetId
        ? or(isNull(appointmentHolds.vetId), eq(appointmentHolds.vetId, input.vetId))
        : undefined;

      const [existingHold] = await ctx.db
        .select({ id: appointmentHolds.id })
        .from(appointmentHolds)
        .where(
          holdVetConflict
            ? and(...holdConflictBase, holdVetConflict)
            : and(...holdConflictBase)
        )
        .limit(1);

      if (existingHold) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Dieser Termin wird gerade von jemand anderem gebucht. Bitte wählen Sie einen anderen Slot.",
        });
      }

      // 3. Check if slot is already booked
      const bookingConflictConditions = [
        eq(appointments.tenantId, input.tenantId),
        lte(appointments.startTime, slotEnd),
        gte(appointments.endTime, input.slotDatetime),
      ];
      if (input.vetId) {
        bookingConflictConditions.push(eq(appointments.vetId, input.vetId));
      }

      const [alreadyBooked] = await ctx.db
        .select({ id: appointments.id })
        .from(appointments)
        .where(and(...bookingConflictConditions))
        .limit(1);

      if (alreadyBooked) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Dieser Termin ist bereits gebucht. Bitte wählen Sie einen anderen Slot.",
        });
      }

      // 4. Create the hold (15 minutes)
      const { randomUUID } = await import("node:crypto");
      const sessionToken = randomUUID();
      const expiresAt = new Date(now.getTime() + 15 * 60_000);

      const [hold] = await ctx.db
        .insert(appointmentHolds)
        .values({
          tenantId: input.tenantId,
          slotDatetime: input.slotDatetime,
          vetId: input.vetId ?? null,
          browserSessionId: input.browserSessionId,
          sessionToken,
          expiresAt,
        })
        .returning();

      return { holdToken: hold.sessionToken, expiresAt: hold.expiresAt };
    }),

  /** Public: Release a hold (user went back or navigated away) */
  releaseHold: publicProcedure
    .input(z.object({ holdToken: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .delete(appointmentHolds)
        .where(eq(appointmentHolds.sessionToken, input.holdToken));
      return { success: true };
    }),

  /** Public: Check if a slot is available (no active hold + no booking) */
  checkSlotAvailability: publicProcedure
    .input(
      z.object({
        tenantId: z.string().uuid(),
        slotDatetime: z.date(),
        vetId: z.string().uuid().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const now = new Date();

      // Fetch vet's slot duration if specified, otherwise default to 30 min
      let slotDurationMin = 30;
      if (input.vetId) {
        const [vet] = await ctx.db
          .select({ slotDurationMin: users.slotDurationMin })
          .from(users)
          .where(eq(users.id, input.vetId))
          .limit(1);
        if (vet) slotDurationMin = vet.slotDurationMin;
      }

      const slotEnd = new Date(input.slotDatetime.getTime() + slotDurationMin * 60_000);

      // Check active holds
      const holdBase = [
        eq(appointmentHolds.tenantId, input.tenantId),
        eq(appointmentHolds.slotDatetime, input.slotDatetime),
        gte(appointmentHolds.expiresAt, now),
      ];
      const holdVet = input.vetId
        ? or(isNull(appointmentHolds.vetId), eq(appointmentHolds.vetId, input.vetId))
        : undefined;

      const [activeHold] = await ctx.db
        .select({ id: appointmentHolds.id })
        .from(appointmentHolds)
        .where(holdVet ? and(...holdBase, holdVet) : and(...holdBase))
        .limit(1);

      if (activeHold) return { available: false, reason: "held" as const };

      // Check existing bookings
      const bookingConditions = [
        eq(appointments.tenantId, input.tenantId),
        lte(appointments.startTime, slotEnd),
        gte(appointments.endTime, input.slotDatetime),
      ];
      if (input.vetId) bookingConditions.push(eq(appointments.vetId, input.vetId));

      const [booking] = await ctx.db
        .select({ id: appointments.id })
        .from(appointments)
        .where(and(...bookingConditions))
        .limit(1);

      return {
        available: !booking,
        reason: booking ? ("booked" as const) : undefined,
      };
    }),

  /** Public: Check which vets have available slots in next 14 days */
  getVetAvailability: publicProcedure
    .input(z.object({ tenantId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      // Get all active vets
      const vets = await ctx.db
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
            eq(users.tenantId, input.tenantId),
            eq(roles.code, ROLE_CODES.VET),
            eq(users.active, true)
          )
        );

      // Generate next 28 calendar days (enough to find working days per vet's schedule)
      const nextDays: Date[] = [];
      const cursor = new Date();
      cursor.setDate(cursor.getDate() + 1);
      for (let i = 0; i < 28; i++) {
        nextDays.push(new Date(cursor));
        cursor.setDate(cursor.getDate() + 1);
      }

      // For each vet, check if they have any available slots in the next 28 days
      const vetAvailability = await Promise.all(
        vets.map(async (vet) => {
          for (const day of nextDays) {
            // Schedule-aware: checks practice hours, vet schedule, absences
            const allSlots = await getVetSlotsForDay(ctx.db, input.tenantId, vet.id, day);
            if (allSlots.length === 0) continue;

            const dayStart = new Date(day);
            dayStart.setHours(0, 0, 0, 0);
            const dayEnd = new Date(day);
            dayEnd.setHours(23, 59, 59, 999);

            const booked = await ctx.db
              .select({ startTime: appointments.startTime, endTime: appointments.endTime })
              .from(appointments)
              .where(
                and(
                  eq(appointments.tenantId, input.tenantId),
                  eq(appointments.vetId, vet.id),
                  gte(appointments.startTime, dayStart),
                  lte(appointments.startTime, dayEnd)
                )
              );

            const hasFreeSlot = allSlots.some(
              (slot) =>
                !booked.some(
                  (a) =>
                    new Date(a.startTime) < slot.end &&
                    new Date(a.endTime) > slot.start
                )
            );

            if (hasFreeSlot) {
              return { id: vet.id, title: vet.title, firstName: vet.firstName, lastName: vet.lastName, hasAvailableSlots: true };
            }
          }

          return { id: vet.id, title: vet.title, firstName: vet.firstName, lastName: vet.lastName, hasAvailableSlots: false };
        })
      );

      return vetAvailability;
    }),

  getEmbedCode: publicProcedure
    .input(z.object({ slug: z.string().min(1) }))
    .query(({ input }) => {
      const bookingUrl = `${getMainDomain()}/book/${input.slug}`;

      const iframeCode = `<iframe src="${bookingUrl}" width="100%" height="600" frameborder="0" style="border:none;border-radius:8px" allow="payment"></iframe>`;

      const modalCode = `<div id="vet-cloud-booking"></div>
<script>
  (function() {
    const button = document.createElement('button');
    button.textContent = 'Termin buchen';
    button.style.cssText = 'padding:10px 20px;background:#007bff;color:white;border:none;border-radius:4px;cursor:pointer;font-size:14px';
    button.onmouseover = () => button.style.background = '#0056b3';
    button.onmouseout = () => button.style.background = '#007bff';

    button.onclick = () => {
      const modal = document.createElement('div');
      modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:10000';

      const container = document.createElement('div');
      container.style.cssText = 'width:90%;height:90%;max-width:600px;background:white;border-radius:8px;overflow:hidden;box-shadow:0 10px 40px rgba(0,0,0,0.2);display:flex;flex-direction:column';

      const closeBtn = document.createElement('button');
      closeBtn.textContent = '✕';
      closeBtn.style.cssText = 'position:absolute;top:10px;right:10px;background:none;border:none;font-size:24px;cursor:pointer;color:#666;width:32px;height:32px';
      closeBtn.onclick = () => document.body.removeChild(modal);

      const iframe = document.createElement('iframe');
      iframe.src = '${bookingUrl}';
      iframe.style.cssText = 'width:100%;height:100%;border:none;flex:1';

      container.appendChild(closeBtn);
      container.appendChild(iframe);
      modal.appendChild(container);
      modal.onclick = (e) => e.target === modal && document.body.removeChild(modal);
      document.body.appendChild(modal);
    };

    const container = document.getElementById('vet-cloud-booking');
    if (container) container.appendChild(button);
  })();
<\/script>`;

      return {
        iframeCode,
        modalCode,
        bookingUrl,
      };
    }),
});
