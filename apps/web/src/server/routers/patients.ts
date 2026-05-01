import { z } from "zod";
import { eq, and, ilike } from "drizzle-orm";
import { createTRPCRouter, protectedProcedure } from "@/server/trpc";
import { patients, owners, users, PERMISSIONS } from "@/lib/db/schema";
import { TRPCError } from "@trpc/server";
import { requirePermission } from "@/server/trpc/middleware";

async function getUserTenant(ctx: any, userId: string) {
  const [user] = await ctx.db
    .select({ tenantId: users.tenantId })
    .from(users)
    .where(eq(users.clerkId, userId))
    .limit(1);

  if (!user?.tenantId) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "User not found or not assigned to a tenant",
    });
  }

  return user.tenantId;
}

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
          color: patients.color,
          birthDate: patients.birthDate,
          weight: patients.weight,
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
    .input(z.object({ id: z.string().uuid(), tenantId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const userTenantId = await getUserTenant(ctx, ctx.userId!);

      if (userTenantId !== input.tenantId) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

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
  create: protectedProcedure
    .use(requirePermission(PERMISSIONS.PATIENTS_CREATE))
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
