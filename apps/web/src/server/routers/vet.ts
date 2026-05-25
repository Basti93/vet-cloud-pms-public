import { z } from "zod";
import { eq, and, count, inArray } from "drizzle-orm";
import { createTRPCRouter, tenantProcedure } from "@/server/trpc";
import { users, appointments, patients, owners, userRoles, roles } from "@/lib/db/schema";
import { TRPCError } from "@trpc/server";
import { ROLE_CODES } from "@/lib/auth/roles";
import { createScheduleService } from "@/server/schedule-service";

export const vetRouter = createTRPCRouter({
  /** Protected: List all active vets for a tenant with their appointment counts */
  list: tenantProcedure
    .input(z.object({ tenantId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      // Include only users with vet role
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
            eq(roles.code, ROLE_CODES.VET),
            eq(users.active, true)
          )
        );

      // Get appointment counts for all vets in a single query (avoid N+1)
      const vetIds = vets.map((v) => v.id);
      const appointmentCounts = await ctx.db
        .select({
          vetId: appointments.vetId,
          appointmentCount: count(),
        })
        .from(appointments)
        .where(
          and(
            eq(appointments.tenantId, input.tenantId),
            inArray(appointments.vetId, vetIds),
            eq(appointments.status, "scheduled")
          )
        )
        .groupBy(appointments.vetId);

      // Build a map for quick lookup
      const countMap = new Map(
        appointmentCounts.map((r) => [r.vetId, r.appointmentCount])
      );

      // Merge appointment counts with vet info
      const vetAppointmentCounts = vets.map((vet) => ({
        ...vet,
        appointmentCount: countMap.get(vet.id) || 0,
      }));

      return vetAppointmentCounts;
    }),

  /** Protected: Get appointments with optional vet filtering */
  getAppointments: tenantProcedure
    .input(
      z.object({
        tenantId: z.string().uuid(),
        vetId: z.string().uuid().optional(),
        status: z
          .enum(["scheduled", "completed", "cancelled", "no-show", "pending-confirmation"])
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
  suggestVet: tenantProcedure
    .input(
      z.object({
        tenantId: z.string().uuid(),
        startTime: z.date().optional(),
        endTime: z.date().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const scheduleService = createScheduleService(ctx.db);
      try {
        return await scheduleService.selectVet({
          tenantId: input.tenantId,
          startTime: input.startTime,
          endTime: input.endTime,
        });
      } catch (error) {
        if (!(error instanceof Error) || error.message !== "No vets available for assignment") {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Kein Tierarzt konfiguriert",
        });
      }
    }),
});
