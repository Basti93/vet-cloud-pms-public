import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, gte, isNull, lte, min, sql, ne } from "drizzle-orm";
import { z } from "zod";
import { PERMISSIONS, owners, patients, users, vaccinationTypes, vaccinations } from "@/lib/db/schema";
import { createTRPCRouter, tenantProcedure, publicProcedure } from "@/server/trpc";
import { requirePermission } from "@/server/trpc/middleware";
import { writeAuditLog } from "@/server/audit";

export const vaccinationsRouter = createTRPCRouter({
  /**
   * Global vaccination type catalogue (STIKO Vet standard).
   * Optionally filter by species (e.g. "Hund", "Katze").
   * Public — no auth required, no tenant data exposed.
   */
  getTypes: publicProcedure
    .input(z.object({ species: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db
        .select()
        .from(vaccinationTypes)
        .where(
          input.species
            ? sql`${vaccinationTypes.species} ILIKE ${"%" + input.species + "%"}`
            : undefined
        )
        .orderBy(asc(vaccinationTypes.sortOrder), asc(vaccinationTypes.name));
      return rows;
    }),

  list: tenantProcedure
    .use(requirePermission(PERMISSIONS.PATIENTS_READ))
    .input(
      z.object({
        tenantId: z.string().uuid(),
        patientId: z.string().uuid(),
      })
    )
    .query(async ({ ctx, input }) => {
      return ctx.db
        .select({
          id: vaccinations.id,
          patientId: vaccinations.patientId,
          vaccinationTypeId: vaccinations.vaccinationTypeId,
          type: vaccinations.type,
          typeCategory: vaccinationTypes.category,
          typeDefaultIntervalMonths: vaccinationTypes.defaultIntervalMonths,
          typeRequiresBatchNumber: vaccinationTypes.requiresBatchNumber,
          administeredDate: vaccinations.administeredDate,
          expiryDate: vaccinations.expiryDate,
          vetId: vaccinations.vetId,
          batchNumber: vaccinations.batchNumber,
          reminderSentDate: vaccinations.reminderSentDate,
          notes: vaccinations.notes,
          createdAt: vaccinations.createdAt,
          updatedAt: vaccinations.updatedAt,
          vetFirstName: users.firstName,
          vetLastName: users.lastName,
        })
        .from(vaccinations)
        .leftJoin(users, eq(vaccinations.vetId, users.id))
        .leftJoin(vaccinationTypes, eq(vaccinations.vaccinationTypeId, vaccinationTypes.id))
        .where(
          and(
            eq(vaccinations.tenantId, input.tenantId),
            eq(vaccinations.patientId, input.patientId),
            isNull(vaccinations.deletedAt)
          )
        )
        .orderBy(desc(vaccinations.administeredDate));
    }),

  create: tenantProcedure
    .use(requirePermission(PERMISSIONS.MEDICAL_CREATE))
    .input(
      z.object({
        tenantId: z.string().uuid(),
        patientId: z.string().uuid(),
        vaccinationTypeId: z.string().uuid().optional(),
        type: z.string().trim().min(1).max(120),
        administeredDate: z.date(),
        expiryDate: z.date(),
        vetId: z.string().uuid().optional(),
        batchNumber: z.string().trim().max(120).optional(),
        notes: z.string().trim().max(2000).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (input.expiryDate <= input.administeredDate) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Expiry date must be after administered date.",
        });
      }

      const [patient] = await ctx.db
        .select({ id: patients.id })
        .from(patients)
        .where(and(eq(patients.id, input.patientId), eq(patients.tenantId, input.tenantId)))
        .limit(1);

      if (!patient) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Patient not found" });
      }

      const [created] = await ctx.db
        .insert(vaccinations)
        .values({
          tenantId: input.tenantId,
          patientId: input.patientId,
          vaccinationTypeId: input.vaccinationTypeId,
          type: input.type,
          administeredDate: input.administeredDate,
          expiryDate: input.expiryDate,
          vetId: input.vetId,
          batchNumber: input.batchNumber,
          notes: input.notes,
        })
        .returning();

      await writeAuditLog(ctx, {
        tenantId: input.tenantId,
        action: "create",
        entity: { type: "vaccination", id: created.id },
        event: "vaccination.created",
        summary: `Vaccination ${input.type} recorded`,
        changes: {
          patientId: input.patientId,
          administeredDate: input.administeredDate.toISOString(),
          expiryDate: input.expiryDate.toISOString(),
        },
      });

      return created;
    }),

  update: tenantProcedure
    .use(requirePermission(PERMISSIONS.MEDICAL_UPDATE))
    .input(
      z.object({
        tenantId: z.string().uuid(),
        vaccinationId: z.string().uuid(),
        vaccinationTypeId: z.string().uuid().nullable().optional(),
        type: z.string().trim().min(1).max(120).optional(),
        administeredDate: z.date().optional(),
        expiryDate: z.date().optional(),
        vetId: z.string().uuid().nullable().optional(),
        batchNumber: z.string().trim().max(120).nullable().optional(),
        notes: z.string().trim().max(2000).nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [current] = await ctx.db
        .select({
          id: vaccinations.id,
          administeredDate: vaccinations.administeredDate,
          expiryDate: vaccinations.expiryDate,
        })
        .from(vaccinations)
        .where(
          and(
            eq(vaccinations.id, input.vaccinationId),
            eq(vaccinations.tenantId, input.tenantId),
            isNull(vaccinations.deletedAt)
          )
        )
        .limit(1);

      if (!current) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Vaccination not found" });
      }

      const nextAdministered = input.administeredDate ?? current.administeredDate;
      const nextExpiry = input.expiryDate ?? current.expiryDate;

      if (nextExpiry <= nextAdministered) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Expiry date must be after administered date.",
        });
      }

      // If expiry date changes, clear reminderSentDate so a new reminder can be sent.
      const expiryChanged =
        input.expiryDate !== undefined &&
        input.expiryDate.getTime() !== current.expiryDate.getTime();

      const [updated] = await ctx.db
        .update(vaccinations)
        .set({
          vaccinationTypeId: input.vaccinationTypeId === undefined ? undefined : input.vaccinationTypeId,
          type: input.type,
          administeredDate: input.administeredDate,
          expiryDate: input.expiryDate,
          vetId: input.vetId === undefined ? undefined : input.vetId,
          batchNumber: input.batchNumber === undefined ? undefined : input.batchNumber,
          notes: input.notes === undefined ? undefined : input.notes,
          reminderSentDate: expiryChanged ? null : undefined,
          updatedAt: new Date(),
        })
        .where(eq(vaccinations.id, input.vaccinationId))
        .returning();

      await writeAuditLog(ctx, {
        tenantId: input.tenantId,
        action: "update",
        entity: { type: "vaccination", id: input.vaccinationId },
        event: "vaccination.updated",
        summary: "Vaccination record updated",
      });

      return updated;
    }),

  delete: tenantProcedure
    .use(requirePermission(PERMISSIONS.MEDICAL_UPDATE))
    .input(
      z.object({
        tenantId: z.string().uuid(),
        vaccinationId: z.string().uuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [deleted] = await ctx.db
        .update(vaccinations)
        .set({ deletedAt: new Date(), updatedAt: new Date() })
        .where(
          and(
            eq(vaccinations.id, input.vaccinationId),
            eq(vaccinations.tenantId, input.tenantId),
            isNull(vaccinations.deletedAt)
          )
        )
        .returning({ id: vaccinations.id });

      if (!deleted) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Vaccination not found" });
      }

      await writeAuditLog(ctx, {
        tenantId: input.tenantId,
        action: "delete",
        entity: { type: "vaccination", id: input.vaccinationId },
        event: "vaccination.deleted",
        summary: "Vaccination record archived",
      });

      return { success: true };
    }),

  getUpcoming: tenantProcedure
    .use(requirePermission(PERMISSIONS.PATIENTS_READ))
    .input(
      z.object({
        tenantId: z.string().uuid(),
        patientId: z.string().uuid(),
        days: z.number().int().min(1).max(365).default(90),
      })
    )
    .query(async ({ ctx, input }) => {
      const now = new Date();
      const until = new Date(now.getTime() + input.days * 24 * 60 * 60 * 1000);

      const rows = await ctx.db
        .select({
          id: vaccinations.id,
          type: vaccinations.type,
          expiryDate: vaccinations.expiryDate,
        })
        .from(vaccinations)
        .where(
          and(
            eq(vaccinations.tenantId, input.tenantId),
            eq(vaccinations.patientId, input.patientId),
            isNull(vaccinations.deletedAt),
            gte(vaccinations.expiryDate, now),
            lte(vaccinations.expiryDate, until)
          )
        )
        .orderBy(vaccinations.expiryDate);

      return rows.map((row) => ({
        ...row,
        daysUntilDue: Math.ceil((row.expiryDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)),
      }));
    }),

  getScanStats: tenantProcedure
    .use(requirePermission(PERMISSIONS.SETTINGS_MANAGE))
    .input(z.object({ tenantId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const now = new Date();
      const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

      const [row] = await ctx.db
        .select({
          totalDue: sql<number>`sum(case when ${vaccinations.expiryDate} < ${sql.raw(`'${now.toISOString()}'`)} then 1 else 0 end)`,
          totalUpcoming: sql<number>`sum(case when ${vaccinations.expiryDate} >= ${sql.raw(`'${now.toISOString()}'`)} and ${vaccinations.expiryDate} <= ${sql.raw(`'${in30Days.toISOString()}'`)} then 1 else 0 end)`,
          totalTracked: sql<number>`count(*)`,
        })
        .from(vaccinations)
        .where(and(eq(vaccinations.tenantId, input.tenantId), isNull(vaccinations.deletedAt)));

      return {
        totalDue: Number(row?.totalDue ?? 0),
        totalUpcoming: Number(row?.totalUpcoming ?? 0),
        totalTracked: Number(row?.totalTracked ?? 0),
      };
    }),

  /**
   * Per-patient vaccination summary for the vaccination management list page.
   * Returns each patient with their soonest-expiring vaccination status.
   */
  getPatientSummaryList: tenantProcedure
    .use(requirePermission(PERMISSIONS.PATIENTS_READ))
    .input(
      z.object({
        tenantId: z.string().uuid(),
        limit: z.number().int().min(1).max(500).default(200),
      })
    )
    .query(async ({ ctx, input }) => {
      const now = new Date();
      const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

      // Use subquery to compute min date, then order by it safely in GROUP BY context
      const subquery = ctx.db
        .select({
          id: patients.id,
          name: patients.name,
          species: patients.species,
          ownerFirstName: owners.firstName,
          ownerLastName: owners.lastName,
          nextDueAt: min(vaccinations.expiryDate).as("next_due_at"),
        })
        .from(patients)
        .leftJoin(owners, eq(patients.ownerId, owners.id))
        .leftJoin(
          vaccinations,
          and(
            eq(vaccinations.patientId, patients.id),
            isNull(vaccinations.deletedAt)
          )
        )
        .where(and(eq(patients.tenantId, input.tenantId), ne(patients.active, false)))
        .groupBy(patients.id, patients.name, patients.species, owners.firstName, owners.lastName)
        .as("patient_summary");

      const rows = await ctx.db
        .select({
          id: subquery.id,
          name: subquery.name,
          species: subquery.species,
          ownerFirstName: subquery.ownerFirstName,
          ownerLastName: subquery.ownerLastName,
          nextDueAt: subquery.nextDueAt,
        })
        .from(subquery)
        .orderBy(
          // Overdue first, then due soon, then current
          sql`CASE
            WHEN ${subquery.nextDueAt} < ${sql.raw(`'${now.toISOString()}'`)} THEN 0
            WHEN ${subquery.nextDueAt} <= ${sql.raw(`'${in30Days.toISOString()}'`)} THEN 1
            ELSE 2
          END`,
          asc(subquery.nextDueAt)
        )
        .limit(input.limit);

      return rows.map((row) => {
        const nextDueAt = row.nextDueAt as Date | null;
        let state: "overdue" | "due30" | "current" | "none" = "none";
        let daysUntilDue: number | null = null;

        if (nextDueAt && nextDueAt instanceof Date) {
          daysUntilDue = Math.ceil((nextDueAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
          if (nextDueAt < now) {
            state = "overdue";
          } else if (nextDueAt <= in30Days) {
            state = "due30";
          } else {
            state = "current";
          }
        }

        return {
          id: row.id,
          name: row.name,
          species: row.species,
          ownerFirstName: row.ownerFirstName,
          ownerLastName: row.ownerLastName,
          nextDueAt,
          state,
          daysUntilDue,
        };
      });
    }),
});
