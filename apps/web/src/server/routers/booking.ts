import { z } from "zod";
import { eq, and, gte, lte, lt, or, isNull } from "drizzle-orm";
import { createTRPCRouter, publicProcedure, protectedProcedure } from "@/server/trpc";
import { tenants, appointments, owners, patients, users, appointmentHolds } from "@/lib/db/schema";
import { TRPCError } from "@trpc/server";
import { sendTemplateEmail } from "@/lib/email/service";
import { confirmationTemplate } from "@/lib/email/templates";
import { generateConfirmationToken, buildConfirmationUrl } from "@/lib/tokens/confirmation";

// ── Slot generation ───────────────────────────────────────────────────────────

const SLOT_DURATION_MIN = 30;
const BUSINESS_START_HOUR = 8;  // 08:00
const BUSINESS_END_HOUR = 18;   // last slot starts 17:30, ends 18:00

function generateDaySlots(date: Date): { start: Date; end: Date }[] {
  const dayOfWeek = date.getDay(); // 0=Sun, 6=Sat
  if (dayOfWeek === 0 || dayOfWeek === 6) return [];

  const now = new Date();
  const slots: { start: Date; end: Date }[] = [];

  for (let hour = BUSINESS_START_HOUR; hour < BUSINESS_END_HOUR; hour++) {
    for (let min = 0; min < 60; min += SLOT_DURATION_MIN) {
      const start = new Date(date);
      start.setHours(hour, min, 0, 0);
      const end = new Date(start.getTime() + SLOT_DURATION_MIN * 60_000);
      if (start > now) {
        slots.push({ start, end });
      }
    }
  }
  return slots;
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
        })
        .from(tenants)
        .where(eq(tenants.slug, input.slug))
        .limit(1);

      if (!tenant) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Praxis nicht gefunden" });
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

      const allSlots = generateDaySlots(input.date);

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
  book: publicProcedure
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

      // Clean up any holds for this slot (booking succeeded)
      await ctx.db
        .delete(appointmentHolds)
        .where(
          and(
            eq(appointmentHolds.tenantId, input.tenantId),
            eq(appointmentHolds.slotDatetime, input.slotStart)
          )
        );

      // Send confirmation email (fire and forget, don't block response)
      const tenant = await ctx.db.query.tenants.findFirst({
        where: (t, { eq }) => eq(t.id, input.tenantId),
      });

      if (tenant && owner.email) {
        try {
          // Generate confirmation token
          const confirmToken = generateConfirmationToken(appointment.id, owner.email!, "confirm");
          const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
          const confirmLink = buildConfirmationUrl(confirmToken, baseUrl, "confirm");

          // Format appointment date/time
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

          // Send email
          const fromEmail = process.env.RESEND_FROM_EMAIL || "noreply@resend.dev";
          await sendTemplateEmail(
            confirmationTemplate,
            owner.email!,
            {
              ownerName: owner.firstName,
              patientName: patient.name,
              clinicName: tenant.name,
              date: dateStr,
              time: timeStr,
              confirmLink,
            },
            `${tenant.name} <${fromEmail}>`
          );
        } catch (emailError) {
          // Log error but don't fail the booking
          console.error("Failed to send confirmation email:", emailError);
        }
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
  holdSlot: publicProcedure
    .input(
      z.object({
        tenantId: z.string().uuid(),
        slotDatetime: z.date(),
        vetId: z.string().uuid().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const now = new Date();
      const slotEnd = new Date(input.slotDatetime.getTime() + SLOT_DURATION_MIN * 60_000);

      // 1. Cleanup expired holds (opportunistic — no separate job needed)
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
      const slotEnd = new Date(input.slotDatetime.getTime() + SLOT_DURATION_MIN * 60_000);

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
        .where(
          and(
            eq(users.tenantId, input.tenantId),
            eq(users.role, "vet"),
            eq(users.active, true)
          )
        );

      // Generate next 14 weekdays
      const weekdays: Date[] = [];
      let cursor = new Date();
      cursor.setDate(cursor.getDate() + 1); // Start from tomorrow
      while (weekdays.length < 14) {
        const dayOfWeek = cursor.getDay();
        if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Not Sunday or Saturday
          weekdays.push(new Date(cursor));
        }
        cursor.setDate(cursor.getDate() + 1);
      }

      // For each vet, check if has available slots
      const vetAvailability = await Promise.all(
        vets.map(async (vet) => {
          // Check all 14 weekdays for this vet
          for (const day of weekdays) {
            const dayStart = new Date(day);
            dayStart.setHours(0, 0, 0, 0);
            const dayEnd = new Date(day);
            dayEnd.setHours(23, 59, 59, 999);

            // Get booked appointments for this vet on this day
            const booked = await ctx.db
              .select({
                startTime: appointments.startTime,
                endTime: appointments.endTime,
              })
              .from(appointments)
              .where(
                and(
                  eq(appointments.tenantId, input.tenantId),
                  eq(appointments.vetId, vet.id),
                  gte(appointments.startTime, dayStart),
                  lte(appointments.startTime, dayEnd)
                )
              );

            // Generate all slots for this day
            const allSlots = generateDaySlots(day);

            // Check if any slot is free
            const hasFreeSlot = allSlots.some(
              (slot) =>
                !booked.some(
                  (a) =>
                    new Date(a.startTime) < slot.end &&
                    new Date(a.endTime) > slot.start
                )
            );

            if (hasFreeSlot) {
              return {
                id: vet.id,
                title: vet.title,
                firstName: vet.firstName,
                lastName: vet.lastName,
                hasAvailableSlots: true,
              };
            }
          }

          // If no free slot found in any of the 14 days
          return {
            id: vet.id,
            title: vet.title,
            firstName: vet.firstName,
            lastName: vet.lastName,
            hasAvailableSlots: false,
          };
        })
      );

      return vetAvailability;
    }),
});
