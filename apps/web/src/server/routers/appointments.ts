import { z } from "zod";
import { eq, and, gte, lte } from "drizzle-orm";
import { createTRPCRouter, tenantProcedure, publicProcedure } from "@/server/trpc";
import { appointments, patients, owners, users, PERMISSIONS } from "@/lib/db/schema";
import { TRPCError } from "@trpc/server";
import { verifyConfirmationToken } from "@/lib/tokens/confirmation";
import { requirePermission } from "@/server/trpc/middleware";
import { appointmentEvents } from "@/lib/events/appointment";
import { writeAuditLog } from "@/server/audit";

export const appointmentsRouter = createTRPCRouter({
  // ── List (simple) ──────────────────────────────────────────────────────────
  list: tenantProcedure
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
  listWithDetails: tenantProcedure
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
    }),

  // ── Single appointment with details ───────────────────────────────────────
  byId: tenantProcedure
    .input(z.object({ id: z.string().uuid(), tenantId: z.string().uuid() }))
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
        .where(and(eq(appointments.id, input.id), eq(appointments.tenantId, input.tenantId)))
        .limit(1);

      if (!rows[0]) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Termin nicht gefunden" });
      }
      return rows[0];
    }),

  // ── Create ─────────────────────────────────────────────────────────────────
  create: tenantProcedure
    .use(requirePermission(PERMISSIONS.APPOINTMENTS_CREATE))
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

      await writeAuditLog(ctx, {
        tenantId: input.tenantId,
        action: "create",
        entity: { type: "appointment", id: created.id },
        event: "appointment.created",
        summary: "Appointment created",
        changes: {
          patientId: created.patientId,
          vetId: created.vetId,
          startTime: created.startTime.toISOString(),
          endTime: created.endTime.toISOString(),
          source: created.source,
          status: created.status,
        },
      });

      appointmentEvents.notifyChange({
        tenantId: input.tenantId,
        vetId: input.vetId,
        appointmentId: created.id,
        type: 'created',
        timestamp: new Date(),
      });

      return created;
    }),

  // ── Update ─────────────────────────────────────────────────────────────────
  update: tenantProcedure
    .use(requirePermission(PERMISSIONS.APPOINTMENTS_UPDATE))
    .input(
      z.object({
        id: z.string().uuid(),
        tenantId: z.string().uuid(),
        title: z.string().min(1).max(255).optional(),
        description: z.string().optional(),
        startTime: z.date().optional(),
        endTime: z.date().optional(),
        status: z
          .enum(["scheduled", "confirmed", "completed", "cancelled", "no-show"])
          .optional(),
        vetId: z.string().uuid().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, tenantId, ...data } = input;
      const [updated] = await ctx.db
        .update(appointments)
        .set({ ...data, updatedAt: new Date() })
        .where(and(eq(appointments.id, id), eq(appointments.tenantId, tenantId)))
        .returning();

      if (!updated) throw new TRPCError({ code: "NOT_FOUND" });

      await writeAuditLog(ctx, {
        tenantId,
        action: "update",
        entity: { type: "appointment", id: updated.id },
        event: "appointment.updated",
        summary: "Appointment updated",
        changes: data,
      });

      appointmentEvents.notifyChange({
        tenantId,
        vetId: updated.vetId || undefined,
        appointmentId: updated.id,
        type: 'updated',
        timestamp: new Date(),
      });

      return updated;
    }),

  // ── List by Patient (for patient detail page) ──────────────────────────────
  listByPatient: tenantProcedure
    .input(
      z.object({
        patientId: z.string().uuid(),
        tenantId: z.string().uuid(),
      })
    )
    .query(async ({ ctx, input }) => {
      return ctx.db
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
        .where(and(eq(appointments.patientId, input.patientId), eq(appointments.tenantId, input.tenantId)))
        .orderBy(appointments.startTime);
    }),

  // ── Delete ─────────────────────────────────────────────────────────────────
  delete: tenantProcedure
    .use(requirePermission(PERMISSIONS.APPOINTMENTS_CANCEL))
    .input(z.object({ id: z.string().uuid(), tenantId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [existing] = await ctx.db
        .select({ id: appointments.id, vetId: appointments.vetId })
        .from(appointments)
        .where(and(eq(appointments.id, input.id), eq(appointments.tenantId, input.tenantId)))
        .limit(1);

      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      await ctx.db
        .delete(appointments)
        .where(and(eq(appointments.id, input.id), eq(appointments.tenantId, input.tenantId)));

      await writeAuditLog(ctx, {
        tenantId: input.tenantId,
        action: "delete",
        entity: { type: "appointment", id: input.id },
        event: "appointment.deleted",
        summary: "Appointment deleted",
        changes: { deleted: true },
      });

      appointmentEvents.notifyChange({
        tenantId: input.tenantId,
        vetId: existing.vetId || undefined,
        appointmentId: existing.id,
        type: 'deleted',
        timestamp: new Date(),
      });

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
      const decoded = verifyConfirmationToken(input.token);

      if (!decoded) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Bestätigungslink ist ungültig oder abgelaufen",
        });
      }

      if (decoded.appointmentId !== input.appointmentId) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Bestätigungstoken stimmt nicht mit dem Termin überein",
        });
      }

      if (decoded.action !== "confirm") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Ungültige Aktion",
        });
      }

      const [appointment] = await ctx.db
        .select({ source: appointments.source })
        .from(appointments)
        .where(eq(appointments.id, input.appointmentId))
        .limit(1);

      if (!appointment) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Termin nicht gefunden",
        });
      }

      const newStatus = appointment.source === "online_booking" ? "confirmed" : "completed";

      const [updated] = await ctx.db
        .update(appointments)
        .set({ status: newStatus, updatedAt: new Date() })
        .where(eq(appointments.id, input.appointmentId))
        .returning();

      if (!updated) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Termin nicht gefunden" });
      }

      appointmentEvents.notifyChange({
        tenantId: updated.tenantId,
        vetId: updated.vetId || undefined,
        appointmentId: updated.id,
        type: 'updated',
        timestamp: new Date(),
      });

      return {
        success: true,
        message: "Termin erfolgreich bestätigt",
        appointmentId: updated.id,
      };
    }),
});
