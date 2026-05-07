import { z } from "zod";
import { eq, and, ilike } from "drizzle-orm";
import { createTRPCRouter, tenantProcedure } from "@/server/trpc";
import { patients, owners, PERMISSIONS } from "@/lib/db/schema";
import { TRPCError } from "@trpc/server";
import { requirePermission } from "@/server/trpc/middleware";
import { writeAuditLog } from "@/server/audit";

export const patientsRouter = createTRPCRouter({
  // List patients (with optional search)
  list: tenantProcedure
    .input(
      z.object({
        tenantId: z.string().uuid(),
        search: z.string().optional(),
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      const conditions = [eq(patients.tenantId, input.tenantId)];

      if (input.search) {
        conditions.push(ilike(patients.name, `%${input.search}%`));
      }

      return ctx.db
        .select({
          id: patients.id,
          name: patients.name,
          species: patients.species,
          breed: patients.breed,
          color: patients.color,
          birthDate: patients.birthDate,
          weight: patients.weight,
          active: patients.active,
          ownerId: patients.ownerId,
          ownerFirstName: owners.firstName,
          ownerLastName: owners.lastName,
          ownerPhone: owners.phone,
          ownerEmail: owners.email,
          ownerEmailOptOut: owners.emailOptOut,
        })
        .from(patients)
        .leftJoin(owners, eq(patients.ownerId, owners.id))
        .where(and(...conditions))
        .limit(input.limit)
        .offset(input.offset)
        .orderBy(patients.name);
    }),

  // Get single patient with owner
  byId: tenantProcedure
    .input(z.object({ id: z.string().uuid(), tenantId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const result = await ctx.db
        .select()
        .from(patients)
        .leftJoin(owners, eq(patients.ownerId, owners.id))
        .where(and(eq(patients.id, input.id), eq(patients.tenantId, input.tenantId)))
        .limit(1);

      if (!result[0]) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Patient nicht gefunden" });
      }

      return result[0];
    }),

  // Create patient + owner
  create: tenantProcedure
    .use(requirePermission(PERMISSIONS.PATIENTS_CREATE))
    .input(
      z.object({
        tenantId: z.string().uuid(),
        ownerFirstName: z.string().min(1),
        ownerLastName: z.string().min(1),
        ownerEmail: z.string().email().optional(),
        ownerPhone: z.string().optional(),
        name: z.string().min(1).max(100),
        species: z.string().min(1),
        breed: z.string().optional(),
        birthDate: z.date().optional(),
        microchipId: z.string().optional(),
        weight: z.number().int().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [owner] = await ctx.db
        .insert(owners)
        .values({
          tenantId: input.tenantId,
          firstName: input.ownerFirstName,
          lastName: input.ownerLastName,
          email: input.ownerEmail,
          phone: input.ownerPhone,
        })
        .returning();

      const [patient] = await ctx.db
        .insert(patients)
        .values({
          tenantId: input.tenantId,
          ownerId: owner!.id,
          name: input.name,
          species: input.species,
          breed: input.breed,
          birthDate: input.birthDate,
          microchipId: input.microchipId,
          weight: input.weight,
          notes: input.notes,
        })
        .returning();

      await writeAuditLog(ctx, {
        tenantId: input.tenantId,
        action: "create",
        entity: { type: "patient", id: patient!.id },
        event: "patient.created",
        summary: "Patient created",
        changes: {
          ownerId: owner!.id,
          species: patient!.species,
        },
      });

      return { patient, owner };
    }),
});
