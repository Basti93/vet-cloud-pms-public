import { z } from "zod";
import { eq, and, ilike, desc } from "drizzle-orm";
import { createTRPCRouter, protectedProcedure } from "@/server/trpc";
import { patients, owners } from "@/lib/db/schema";
import { TRPCError } from "@trpc/server";

export const patientsRouter = createTRPCRouter({
  // List patients (with optional search)
  list: protectedProcedure
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
          birthDate: patients.birthDate,
          weight: patients.weight,
          color: patients.color,
          allergies: patients.allergies,
          active: patients.active,
          ownerId: patients.ownerId,
          ownerFirstName: owners.firstName,
          ownerLastName: owners.lastName,
          ownerPhone: owners.phone,
        })
        .from(patients)
        .leftJoin(owners, eq(patients.ownerId, owners.id))
        .where(and(...conditions))
        .limit(input.limit)
        .offset(input.offset)
        .orderBy(patients.name);
    }),

  // Get single patient with owner
  byId: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const result = await ctx.db
        .select()
        .from(patients)
        .leftJoin(owners, eq(patients.ownerId, owners.id))
        .where(eq(patients.id, input.id))
        .limit(1);

      if (!result[0]) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Patient nicht gefunden" });
      }

      return result[0];
    }),

  // Create patient + owner
  create: protectedProcedure
    .input(
      z.object({
        tenantId: z.string().uuid(),
        // Owner data
        ownerFirstName: z.string().min(1),
        ownerLastName: z.string().min(1),
        ownerEmail: z.string().email().optional(),
        ownerPhone: z.string().optional(),
        // Patient data
        name: z.string().min(1).max(100),
        species: z.string().min(1),
        breed: z.string().optional(),
        birthDate: z.date().optional(),
        microchipId: z.string().optional(),
        weight: z.number().int().optional(), // in gramm
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Create owner first
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

      // Create patient
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

      return { patient, owner };
    }),
});
