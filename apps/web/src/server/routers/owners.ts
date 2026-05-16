import { z } from "zod";
import { and, asc, desc, eq, ilike, max, ne, or, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, tenantProcedure } from "@/server/trpc";
import { appointments, owners, patients, PERMISSIONS } from "@/lib/db/schema";
import { requirePermission } from "@/server/trpc/middleware";
import { writeAuditLog } from "@/server/audit";

const ownerFields = {
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().max(20).optional().or(z.literal("")),
  address: z.string().optional(),
  city: z.string().max(100).optional().or(z.literal("")),
  postalCode: z.string().max(20).optional().or(z.literal("")),
  country: z.string().length(2).optional(),
  notes: z.string().optional(),
};

function cleanOptional(value?: string) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export const ownersRouter = createTRPCRouter({
  list: tenantProcedure
    .input(
      z.object({
        tenantId: z.string().uuid(),
        search: z.string().optional(),
        includeInactive: z.boolean().default(false),
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      const conditions = [eq(owners.tenantId, input.tenantId)];

      if (!input.includeInactive) {
        conditions.push(eq(owners.active, true));
      }

      if (input.search?.trim()) {
        const term = `%${input.search.trim()}%`;
        conditions.push(
          or(
            ilike(owners.firstName, term),
            ilike(owners.lastName, term),
            ilike(owners.email, term),
            ilike(owners.phone, term),
            sql`${owners.firstName} || ' ' || ${owners.lastName} ilike ${term}`
          )!
        );
      }

      return ctx.db
        .select({
          id: owners.id,
          firstName: owners.firstName,
          lastName: owners.lastName,
          email: owners.email,
          phone: owners.phone,
          address: owners.address,
          city: owners.city,
          postalCode: owners.postalCode,
          active: owners.active,
          createdAt: owners.createdAt,
          patientCount: sql<number>`count(distinct ${patients.id})::int`,
          lastAppointment: max(appointments.startTime),
        })
        .from(owners)
        .leftJoin(patients, eq(patients.ownerId, owners.id))
        .leftJoin(appointments, eq(appointments.patientId, patients.id))
        .where(and(...conditions))
        .groupBy(
          owners.id,
          owners.firstName,
          owners.lastName,
          owners.email,
          owners.phone,
          owners.address,
          owners.city,
          owners.postalCode,
          owners.active,
          owners.createdAt
        )
        .orderBy(asc(owners.lastName), asc(owners.firstName))
        .limit(input.limit)
        .offset(input.offset);
    }),

  byId: tenantProcedure
    .input(z.object({ id: z.string().uuid(), tenantId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [owner] = await ctx.db
        .select()
        .from(owners)
        .where(and(eq(owners.id, input.id), eq(owners.tenantId, input.tenantId)))
        .limit(1);

      if (!owner) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Tierhalter nicht gefunden" });
      }

      const ownerPatients = await ctx.db
        .select({
          id: patients.id,
          name: patients.name,
          species: patients.species,
          breed: patients.breed,
          birthDate: patients.birthDate,
          weight: patients.weight,
          active: patients.active,
        })
        .from(patients)
        .where(and(eq(patients.ownerId, input.id), eq(patients.tenantId, input.tenantId)))
        .orderBy(asc(patients.name));

      const recentAppointments = await ctx.db
        .select({
          id: appointments.id,
          title: appointments.title,
          startTime: appointments.startTime,
          endTime: appointments.endTime,
          status: appointments.status,
          source: appointments.source,
          patientId: patients.id,
          patientName: patients.name,
          patientSpecies: patients.species,
        })
        .from(appointments)
        .innerJoin(patients, eq(appointments.patientId, patients.id))
        .where(and(eq(patients.ownerId, input.id), eq(appointments.tenantId, input.tenantId)))
        .orderBy(desc(appointments.startTime))
        .limit(25);

      return { owner, patients: ownerPatients, recentAppointments };
    }),

  create: tenantProcedure
    .use(requirePermission(PERMISSIONS.PATIENTS_CREATE))
    .input(z.object({ tenantId: z.string().uuid(), ...ownerFields }))
    .mutation(async ({ ctx, input }) => {
      const email = cleanOptional(input.email);
      if (email) {
        const [existingOwner] = await ctx.db
          .select()
          .from(owners)
          .where(
            and(
              eq(owners.tenantId, input.tenantId),
              sql`lower(${owners.email}) = lower(${email})`
            )
          )
          .limit(1);

        if (existingOwner?.active) {
          return existingOwner;
        }

        if (existingOwner) {
          const [reactivatedOwner] = await ctx.db
            .update(owners)
            .set({
              firstName: input.firstName.trim(),
              lastName: input.lastName.trim(),
              phone: cleanOptional(input.phone),
              address: cleanOptional(input.address),
              city: cleanOptional(input.city),
              postalCode: cleanOptional(input.postalCode),
              country: input.country ?? existingOwner.country ?? "DE",
              notes: cleanOptional(input.notes),
              active: true,
              updatedAt: new Date(),
            })
            .where(and(eq(owners.id, existingOwner.id), eq(owners.tenantId, input.tenantId)))
            .returning();

          await writeAuditLog(ctx, {
            tenantId: input.tenantId,
            action: "update",
            entity: { type: "owner", id: reactivatedOwner.id },
            event: "owner.reactivated",
            summary: "Owner reactivated",
            changes: { email: reactivatedOwner.email },
          });

          return reactivatedOwner;
        }
      }

      const [owner] = await ctx.db
        .insert(owners)
        .values({
          tenantId: input.tenantId,
          firstName: input.firstName.trim(),
          lastName: input.lastName.trim(),
          email,
          phone: cleanOptional(input.phone),
          address: cleanOptional(input.address),
          city: cleanOptional(input.city),
          postalCode: cleanOptional(input.postalCode),
          country: input.country ?? "DE",
          notes: cleanOptional(input.notes),
        })
        .returning();

      await writeAuditLog(ctx, {
        tenantId: input.tenantId,
        action: "create",
        entity: { type: "owner", id: owner.id },
        event: "owner.created",
        summary: "Owner created",
        changes: { email: owner.email },
      });

      return owner;
    }),

  update: tenantProcedure
    .use(requirePermission(PERMISSIONS.PATIENTS_UPDATE))
    .input(
      z.object({
        id: z.string().uuid(),
        tenantId: z.string().uuid(),
        firstName: z.string().min(1).max(100).optional(),
        lastName: z.string().min(1).max(100).optional(),
        email: z.string().email().optional().or(z.literal("")),
        phone: z.string().max(20).optional().or(z.literal("")),
        address: z.string().optional(),
        city: z.string().max(100).optional().or(z.literal("")),
        postalCode: z.string().max(20).optional().or(z.literal("")),
        country: z.string().length(2).optional(),
        notes: z.string().optional(),
        emailOptOut: z.boolean().optional(),
        active: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, tenantId, ...data } = input;
      const [updated] = await ctx.db
        .update(owners)
        .set({
          ...data,
          firstName: data.firstName?.trim(),
          lastName: data.lastName?.trim(),
          email: cleanOptional(data.email),
          phone: cleanOptional(data.phone),
          address: cleanOptional(data.address),
          city: cleanOptional(data.city),
          postalCode: cleanOptional(data.postalCode),
          notes: cleanOptional(data.notes),
          updatedAt: new Date(),
        })
        .where(and(eq(owners.id, id), eq(owners.tenantId, tenantId)))
        .returning();

      if (!updated) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Tierhalter nicht gefunden" });
      }

      await writeAuditLog(ctx, {
        tenantId,
        action: "update",
        entity: { type: "owner", id: updated.id },
        event: "owner.updated",
        summary: "Owner updated",
        changes: data,
      });

      return updated;
    }),

  merge: tenantProcedure
    .use(requirePermission(PERMISSIONS.PATIENTS_UPDATE))
    .input(
      z.object({
        tenantId: z.string().uuid(),
        targetId: z.string().uuid(),
        sourceId: z.string().uuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (input.targetId === input.sourceId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Quelle und Ziel müssen unterschiedlich sein" });
      }

      const [target, source] = await Promise.all([
        ctx.db.select({ id: owners.id }).from(owners).where(and(eq(owners.id, input.targetId), eq(owners.tenantId, input.tenantId))).limit(1),
        ctx.db.select({ id: owners.id }).from(owners).where(and(eq(owners.id, input.sourceId), eq(owners.tenantId, input.tenantId))).limit(1),
      ]);

      if (!target[0] || !source[0]) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Tierhalter nicht gefunden" });
      }

      await ctx.db.transaction(async (tx) => {
        await tx
          .update(patients)
          .set({ ownerId: input.targetId, updatedAt: new Date() })
          .where(and(eq(patients.ownerId, input.sourceId), eq(patients.tenantId, input.tenantId)));

        await tx
          .delete(owners)
          .where(and(eq(owners.id, input.sourceId), eq(owners.tenantId, input.tenantId)));
      });

      await writeAuditLog(ctx, {
        tenantId: input.tenantId,
        action: "update",
        entity: { type: "owner", id: input.targetId },
        event: "owner.merged",
        summary: "Owner merged",
        changes: { sourceId: input.sourceId, targetId: input.targetId },
      });

      return { success: true, targetId: input.targetId };
    }),

  delete: tenantProcedure
    .use(requirePermission(PERMISSIONS.PATIENTS_UPDATE))
    .input(z.object({ id: z.string().uuid(), tenantId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.transaction(async (tx) => {
        await tx
          .update(patients)
          .set({ active: false, updatedAt: new Date() })
          .where(and(eq(patients.ownerId, input.id), eq(patients.tenantId, input.tenantId)));

        await tx
          .update(owners)
          .set({ active: false, updatedAt: new Date() })
          .where(and(eq(owners.id, input.id), eq(owners.tenantId, input.tenantId)));
      });

      await writeAuditLog(ctx, {
        tenantId: input.tenantId,
        action: "delete",
        entity: { type: "owner", id: input.id },
        event: "owner.deactivated",
        summary: "Owner deactivated",
        changes: { active: false },
      });

      return { success: true };
    }),

  findDuplicateCandidates: tenantProcedure
    .input(
      z.object({
        tenantId: z.string().uuid(),
        ownerId: z.string().uuid(),
        search: z.string().min(1),
      })
    )
    .query(async ({ ctx, input }) => {
      const term = `%${input.search.trim()}%`;
      return ctx.db
        .select({
          id: owners.id,
          firstName: owners.firstName,
          lastName: owners.lastName,
          email: owners.email,
          phone: owners.phone,
        })
        .from(owners)
        .where(
          and(
            eq(owners.tenantId, input.tenantId),
            ne(owners.id, input.ownerId),
            eq(owners.active, true),
            or(
              ilike(owners.firstName, term),
              ilike(owners.lastName, term),
              ilike(owners.email, term),
              ilike(owners.phone, term),
              sql`${owners.firstName} || ' ' || ${owners.lastName} ilike ${term}`
            )
          )
        )
        .orderBy(asc(owners.lastName), asc(owners.firstName))
        .limit(10);
    }),
});
