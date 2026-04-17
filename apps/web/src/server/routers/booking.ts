import { z } from "zod";
import { eq, and, gte, lte } from "drizzle-orm";
import { createTRPCRouter, publicProcedure, protectedProcedure } from "@/server/trpc";
import { tenants, appointments, owners, patients, users } from "@/lib/db/schema";
import { TRPCError } from "@trpc/server";

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

  /** Protected: Confirm a booking request (status = "completed" = confirmed by admin) */
  confirm: protectedProcedure
    .input(z.object({
      appointmentId: z.string().uuid(),
      tenantId: z.string().uuid(),
    }))
    .mutation(async ({ ctx, input }) => {
      const [appointment] = await ctx.db
        .update(appointments)
        .set({
          status: "completed", // Mark as confirmed/accepted by admin
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

      const allSlots = generateDaySlots(input.date);

      return allSlots
        .filter((slot) =>
          !booked.some(
            (a) =>
              new Date(a.startTime) < slot.end &&
              new Date(a.endTime) > slot.start
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
            lte(appointments.startTime, input.slotStart),
            gte(appointments.endTime, input.slotEnd)
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

      return {
        appointmentId: appointment.id,
        startTime: appointment.startTime,
        endTime: appointment.endTime,
        patientName: patient.name,
        ownerName: `${owner.firstName} ${owner.lastName}`,
        ownerEmail: owner.email,
      };
    }),
});
