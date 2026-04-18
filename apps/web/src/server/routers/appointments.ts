import { z } from "zod";
import { eq, and, gte, lte } from "drizzle-orm";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "@/server/trpc";
import { appointments, patients, owners, users } from "@/lib/db/schema";
import { TRPCError } from "@trpc/server";
import { verifyConfirmationToken } from "@/lib/tokens/confirmation";

export const appointmentsRouter = createTRPCRouter({
  // ── List (simple) ──────────────────────────────────────────────────────────
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
      if (input.from) conditions.push(gte(appointments.startTime, input.from));
      if (input.to) conditions.push(lte(appointments.endTime, input.to));

      return ctx.db
        .select()
        .from(appointments)
        .where(and(...conditions))
        .orderBy(appointments.startTime);
    }),

  // ── List with patient + owner details (for calendar & lists) ──────────────
  listWithDetails: protectedProcedure
    .input(
      z.object({
        tenantId: z.string().uuid(),
        from: z.date().optional(),
        to: z.date().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const conditions = [eq(appointments.tenantId, input.tenantId)];
      if (input.from) conditions.push(gte(appointments.startTime, input.from));
      if (input.to) conditions.push(lte(appointments.endTime, input.to));

      const rows = await ctx.db
        .select({
          id: appointments.id,
          tenantId: appointments.tenantId,
          title: appointments.title,
          description: appointments.description,
          startTime: appointments.startTime,
          endTime: appointments.endTime,
          status: appointments.status,
          source: appointments.source,
          patientId: appointments.patientId,
          vetId: appointments.vetId,
          createdAt: appointments.createdAt,
          patientName: patients.name,
          patientSpecies: patients.species,
          ownerFirstName: owners.firstName,
          ownerLastName: owners.lastName,
          ownerPhone: owners.phone,
          vetFirstName: users.firstName,
          vetLastName: users.lastName,
        })
        .from(appointments)
        .leftJoin(patients, eq(appointments.patientId, patients.id))
        .leftJoin(owners, eq(patients.ownerId, owners.id))
        .leftJoin(users, eq(appointments.vetId, users.id))
        .where(and(...conditions))
        .orderBy(appointments.startTime);

      return rows;
    }),

  // ── Single appointment with details ───────────────────────────────────────
  byId: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db
        .select({
          id: appointments.id,
          tenantId: appointments.tenantId,
          title: appointments.title,
          description: appointments.description,
          startTime: appointments.startTime,
          endTime: appointments.endTime,
          status: appointments.status,
          source: appointments.source,
          patientId: appointments.patientId,
          vetId: appointments.vetId,
          createdAt: appointments.createdAt,
          patientName: patients.name,
          patientSpecies: patients.species,
          ownerFirstName: owners.firstName,
          ownerLastName: owners.lastName,
          ownerPhone: owners.phone,
        })
        .from(appointments)
        .leftJoin(patients, eq(appointments.patientId, patients.id))
        .leftJoin(owners, eq(patients.ownerId, owners.id))
        .where(eq(appointments.id, input.id))
        .limit(1);

      if (!rows[0]) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Termin nicht gefunden" });
      }
      return rows[0];
    }),

  // ── Create ─────────────────────────────────────────────────────────────────
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
        .values({ ...input, status: "scheduled" })
        .returning();
      return created;
    }),

  // ── Update ─────────────────────────────────────────────────────────────────
  update: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        title: z.string().min(1).max(255).optional(),
        description: z.string().optional(),
        startTime: z.date().optional(),
        endTime: z.date().optional(),
        status: z
          .enum(["scheduled", "completed", "cancelled", "no-show"])
          .optional(),
        vetId: z.string().uuid().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const [updated] = await ctx.db
        .update(appointments)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(appointments.id, id))
        .returning();

      if (!updated) throw new TRPCError({ code: "NOT_FOUND" });
      return updated;
    }),

  // ── List by Patient (for patient detail page) ──────────────────────────────
  listByPatient: protectedProcedure
    .input(
      z.object({
        patientId: z.string().uuid(),
      })
    )
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db
        .select({
          id: appointments.id,
          title: appointments.title,
          startTime: appointments.startTime,
          endTime: appointments.endTime,
          status: appointments.status,
          source: appointments.source,
          createdAt: appointments.createdAt,
          vetFirstName: users.firstName,
          vetLastName: users.lastName,
        })
        .from(appointments)
        .leftJoin(users, eq(appointments.vetId, users.id))
        .where(eq(appointments.patientId, input.patientId))
        .orderBy(appointments.startTime);

      return rows;
    }),

  // ── Delete ─────────────────────────────────────────────────────────────────
  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.delete(appointments).where(eq(appointments.id, input.id));
      return { success: true };
    }),

  // ── Confirm from Email Link ────────────────────────────────────────────────
  confirmFromEmail: publicProcedure
    .input(
      z.object({
        appointmentId: z.string().uuid(),
        token: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify token
      const decoded = verifyConfirmationToken(input.token);

      if (!decoded) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Bestätigungslink ist ungültig oder abgelaufen",
        });
      }

      // Verify appointment ID matches token
      if (decoded.appointmentId !== input.appointmentId) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Bestätigungstoken stimmt nicht mit dem Termin überein",
        });
      }

      // Verify action is confirm
      if (decoded.action !== "confirm") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Ungültige Aktion",
        });
      }

      // Update appointment status
      const [updated] = await ctx.db
        .update(appointments)
        .set({
          status: "confirmed",
          updatedAt: new Date(),
        })
        .where(eq(appointments.id, input.appointmentId))
        .returning();

      if (!updated) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Termin nicht gefunden",
        });
      }

      return {
        success: true,
        message: "Termin erfolgreich bestätigt",
        appointmentId: updated.id,
      };
    }),
});
