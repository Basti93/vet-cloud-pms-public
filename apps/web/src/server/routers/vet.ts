import { z } from "zod";
import { eq, and, or, count, lte, gte } from "drizzle-orm";
import { createTRPCRouter, protectedProcedure } from "@/server/trpc";
import { users, appointments, patients, owners, userRoles, roles } from "@/lib/db/schema";
import { TRPCError } from "@trpc/server";
import { ROLE_CODES } from "@/lib/auth/roles";

// ── Fair Distribution Algorithm ───────────────────────────────────────────
/**
 * Finds the vet with the fewest appointments in the given time range
 * Useful for auto-assigning appointments when user doesn't select a vet
 */
function selectVetByFairDistribution(
  vets: Array<{ id: string; appointmentCount: number }>
): string {
  if (vets.length === 0) {
    throw new Error("No vets available for assignment");
  }
  // Sort by appointment count and pick the one with fewest
  return vets.sort((a, b) => a.appointmentCount - b.appointmentCount)[0].id;
}

export const vetRouter = createTRPCRouter({
  /** Protected: List all active vets for a tenant with their appointment counts */
  list: protectedProcedure
    .input(z.object({ tenantId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      // Include both vet and admin roles - admins can be booked as vets
      const vets = await ctx.db
        .select({
          id: users.id,
          title: users.title,
          firstName: users.firstName,
          lastName: users.lastName,
          email: users.email,
        })
        .from(users)
        .innerJoin(userRoles, eq(userRoles.userId, users.id))
        .innerJoin(roles, eq(roles.id, userRoles.roleId))
        .where(
          and(
            eq(users.tenantId, input.tenantId),
            or(eq(roles.code, ROLE_CODES.VET), eq(roles.code, ROLE_CODES.ADMIN)),
            eq(users.active, true)
          )
        );

      // Get appointment counts for each vet
      const vetAppointmentCounts = await Promise.all(
        vets.map(async (vet) => {
          const [result] = await ctx.db
            .select({ count: count() })
            .from(appointments)
            .where(
              and(
                eq(appointments.tenantId, input.tenantId),
                eq(appointments.vetId, vet.id),
                eq(appointments.status, "scheduled")
              )
            );

          return {
            ...vet,
            appointmentCount: result.count || 0,
          };
        })
      );

      return vetAppointmentCounts;
    }),

  /** Protected: Get appointments with optional vet filtering */
  getAppointments: protectedProcedure
    .input(
      z.object({
        tenantId: z.string().uuid(),
        vetId: z.string().uuid().optional(),
        status: z
          .enum(["scheduled", "completed", "cancelled", "no-show"])
          .optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const conditions = [eq(appointments.tenantId, input.tenantId)];

      if (input.vetId) {
        conditions.push(eq(appointments.vetId, input.vetId));
      }

      if (input.status) {
        conditions.push(eq(appointments.status, input.status));
      }

      const result = await ctx.db
        .select({
          id: appointments.id,
          startTime: appointments.startTime,
          endTime: appointments.endTime,
          title: appointments.title,
          status: appointments.status,
          createdAt: appointments.createdAt,
          vet: {
            id: users.id,
            title: users.title,
            firstName: users.firstName,
            lastName: users.lastName,
          },
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
            phone: owners.phone,
          },
        })
        .from(appointments)
        .innerJoin(users, eq(appointments.vetId, users.id))
        .innerJoin(patients, eq(appointments.patientId, patients.id))
        .innerJoin(owners, eq(patients.ownerId, owners.id))
        .where(and(...conditions));

      return result;
    }),

  /**
   * Protected: Suggest the best vet based on fair distribution
   * Used when creating an appointment and user doesn't select a vet
   */
  suggestVet: protectedProcedure
    .input(
      z.object({
        tenantId: z.string().uuid(),
        startTime: z.date().optional(),
        endTime: z.date().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Get all active vets and admins (admins can be booked as vets)
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
            or(eq(roles.code, ROLE_CODES.VET), eq(roles.code, ROLE_CODES.ADMIN)),
            eq(users.active, true)
          )
        );

      if (vets.length === 0) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Kein Tierarzt konfiguriert",
        });
      }

      // For each vet, count appointments in the target time range (if provided)
      // Otherwise just count all scheduled appointments
      const vetWithCounts = await Promise.all(
        vets.map(async (vet) => {
          const baseConditions = [
            eq(appointments.tenantId, input.tenantId),
            eq(appointments.vetId, vet.id),
            eq(appointments.status, "scheduled"),
          ];

          const whereClause =
            input.startTime && input.endTime
              ? and(
                  ...baseConditions,
                  and(
                    lte(appointments.startTime, input.endTime),
                    gte(appointments.endTime, input.startTime)
                  )
                )
              : and(...baseConditions);

          const [result] = await ctx.db
            .select({ count: count() })
            .from(appointments)
            .where(whereClause);

          return {
            id: vet.id,
            title: vet.title,
            firstName: vet.firstName,
            lastName: vet.lastName,
            appointmentCount: result.count || 0,
          };
        })
      );

      // Apply fair distribution
      const suggestedVetId = selectVetByFairDistribution(vetWithCounts);
      const suggestedVet = vetWithCounts.find((v) => v.id === suggestedVetId)!;

      return suggestedVet;
    }),
});
