import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, gte, inArray, isNull, lte, min, sql, ne } from "drizzle-orm";
import { z } from "zod";
import {
  PERMISSIONS,
  owners,
  patients,
  users,
  vaccinationTypes,
  tenantVaccinationTypeConfig,
  vaccinations,
} from "@/lib/db/schema";
import { createTRPCRouter, tenantProcedure } from "@/server/trpc";
import { requirePermission } from "@/server/trpc/middleware";
import { writeAuditLog } from "@/server/audit";

// Shape returned by getTypes — unified across global and custom types
const effectiveTypeSchema = z.object({
  id: z.string().uuid(),
  code: z.string(),
  name: z.string(),
  species: z.string(),
  category: z.string(),
  defaultIntervalMonths: z.number(),
  seriesDoses: z.number(),
  minIntervalDays: z.number().nullable(),
  requiresBatchNumber: z.boolean(),
  sortOrder: z.number(),
  notes: z.string().nullable(),
  source: z.enum(["global", "custom"]),
});

export const vaccinationsRouter = createTRPCRouter({
  /**
   * Tenant-aware vaccination type catalogue.
   * Returns: global STIKO types (minus disabled) + tenant custom types.
   * Optionally filtered by species string (case-insensitive substring match).
   */
  getTypes: tenantProcedure
    .use(requirePermission(PERMISSIONS.PATIENTS_READ))
    .input(z.object({ tenantId: z.string().uuid(), species: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      // 1. Load all global types
      const globals = await ctx.db
        .select()
        .from(vaccinationTypes)
        .orderBy(asc(vaccinationTypes.sortOrder), asc(vaccinationTypes.name));

      // 2. Load this tenant's config (disabled flags + custom types)
      const configs = await ctx.db
        .select()
        .from(tenantVaccinationTypeConfig)
        .where(eq(tenantVaccinationTypeConfig.tenantId, input.tenantId));

      const disabledIds = new Set(
        configs
          .filter((c) => c.vaccinationTypeId !== null && !c.enabled)
          .map((c) => c.vaccinationTypeId as string)
      );

      // 3. Merge into a unified shape
      const speciesFilter = input.species?.toLowerCase();

      const result = z.array(effectiveTypeSchema).parse([
        // Global types not disabled by this tenant
        ...globals
          .filter((t) => !disabledIds.has(t.id))
          .filter((t) =>
            speciesFilter ? t.species.toLowerCase().includes(speciesFilter) : true
          )
          .map((t) => ({
            id: t.id,
            code: t.code,
            name: t.name,
            species: t.species,
            category: t.category,
            defaultIntervalMonths: t.defaultIntervalMonths,
            seriesDoses: t.seriesDoses,
            minIntervalDays: t.minIntervalDays,
            requiresBatchNumber: t.requiresBatchNumber,
            sortOrder: t.sortOrder,
            notes: t.notes,
            source: "global" as const,
          })),

        // Tenant custom types (vaccinationTypeId IS NULL, enabled=true)
        ...configs
          .filter((c) => c.vaccinationTypeId === null && c.enabled && c.customName)
          .filter((c) =>
            speciesFilter
              ? (c.customSpecies ?? "").toLowerCase().includes(speciesFilter)
              : true
          )
          .map((c) => ({
            id: c.id,
            code: c.customName!,
            name: c.customName!,
            species: c.customSpecies ?? "",
            category: c.customCategory ?? "non-core",
            defaultIntervalMonths: c.customIntervalMonths ?? 12,
            seriesDoses: 1,
            minIntervalDays: null,
            requiresBatchNumber: c.customRequiresBatchNumber ?? false,
            sortOrder: c.sortOrder,
            notes: c.customNotes,
            source: "custom" as const,
          })),
      ]);

      return result.sort(
        (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)
      );
    }),

  /**
   * Returns the full config for the settings UI:
   * all global types with their enabled-state for this tenant,
   * plus all custom types.
   */
  getTypeConfig: tenantProcedure
    .use(requirePermission(PERMISSIONS.SETTINGS_MANAGE))
    .input(z.object({ tenantId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [globals, configs] = await Promise.all([
        ctx.db
          .select()
          .from(vaccinationTypes)
          .orderBy(asc(vaccinationTypes.sortOrder), asc(vaccinationTypes.name)),
        ctx.db
          .select()
          .from(tenantVaccinationTypeConfig)
          .where(eq(tenantVaccinationTypeConfig.tenantId, input.tenantId)),
      ]);

      const configByTypeId = new Map(
        configs
          .filter((c) => c.vaccinationTypeId !== null)
          .map((c) => [c.vaccinationTypeId!, c])
      );

      const customTypes = configs.filter((c) => c.vaccinationTypeId === null);

      return {
        globalTypes: globals.map((t) => ({
          ...t,
          enabled: configByTypeId.get(t.id)?.enabled ?? true,
          configId: configByTypeId.get(t.id)?.id ?? null,
        })),
        customTypes,
      };
    }),

  /** Toggle a global type on/off for this tenant. */
  setGlobalTypeEnabled: tenantProcedure
    .use(requirePermission(PERMISSIONS.SETTINGS_MANAGE))
    .input(
      z.object({
        tenantId: z.string().uuid(),
        vaccinationTypeId: z.string().uuid(),
        enabled: z.boolean(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .insert(tenantVaccinationTypeConfig)
        .values({
          tenantId: input.tenantId,
          vaccinationTypeId: input.vaccinationTypeId,
          enabled: input.enabled,
        })
        .onConflictDoUpdate({
          target: [
            tenantVaccinationTypeConfig.tenantId,
            tenantVaccinationTypeConfig.vaccinationTypeId,
          ],
          set: {
            enabled: input.enabled,
            updatedAt: new Date(),
          },
        });
      return { success: true };
    }),

  /** Add a tenant-specific custom vaccination type. */
  addCustomType: tenantProcedure
    .use(requirePermission(PERMISSIONS.SETTINGS_MANAGE))
    .input(
      z.object({
        tenantId: z.string().uuid(),
        name: z.string().trim().min(1).max(150),
        species: z.string().trim().min(1).max(200),
        category: z.enum(["core", "recommended", "non-core"]).default("recommended"),
        intervalMonths: z.number().int().min(1).max(120),
        requiresBatchNumber: z.boolean().default(false),
        notes: z.string().trim().max(500).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [created] = await ctx.db
        .insert(tenantVaccinationTypeConfig)
        .values({
          tenantId: input.tenantId,
          vaccinationTypeId: null,
          enabled: true,
          customName: input.name,
          customSpecies: input.species,
          customCategory: input.category,
          customIntervalMonths: input.intervalMonths,
          customRequiresBatchNumber: input.requiresBatchNumber,
          customNotes: input.notes ?? null,
        })
        .returning();
      return created;
    }),

  /** Update a tenant custom type. */
  updateCustomType: tenantProcedure
    .use(requirePermission(PERMISSIONS.SETTINGS_MANAGE))
    .input(
      z.object({
        tenantId: z.string().uuid(),
        configId: z.string().uuid(),
        name: z.string().trim().min(1).max(150).optional(),
        species: z.string().trim().min(1).max(200).optional(),
        category: z.enum(["core", "recommended", "non-core"]).optional(),
        intervalMonths: z.number().int().min(1).max(120).optional(),
        requiresBatchNumber: z.boolean().optional(),
        notes: z.string().trim().max(500).nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(tenantVaccinationTypeConfig)
        .set({
          customName: input.name,
          customSpecies: input.species,
          customCategory: input.category,
          customIntervalMonths: input.intervalMonths,
          customRequiresBatchNumber: input.requiresBatchNumber,
          customNotes: input.notes === undefined ? undefined : input.notes,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(tenantVaccinationTypeConfig.id, input.configId),
            eq(tenantVaccinationTypeConfig.tenantId, input.tenantId),
            isNull(tenantVaccinationTypeConfig.vaccinationTypeId)
          )
        )
        .returning();

      if (!updated) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Custom type not found" });
      }
      return updated;
    }),

  /** Remove a tenant custom type. */
  removeCustomType: tenantProcedure
    .use(requirePermission(PERMISSIONS.SETTINGS_MANAGE))
    .input(z.object({ tenantId: z.string().uuid(), configId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [deleted] = await ctx.db
        .delete(tenantVaccinationTypeConfig)
        .where(
          and(
            eq(tenantVaccinationTypeConfig.id, input.configId),
            eq(tenantVaccinationTypeConfig.tenantId, input.tenantId),
            isNull(tenantVaccinationTypeConfig.vaccinationTypeId)
          )
        )
        .returning({ id: tenantVaccinationTypeConfig.id });

      if (!deleted) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Custom type not found" });
      }
      return { success: true };
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
        // Global STIKO type selected
        vaccinationTypeId: z.string().uuid().optional(),
        // Tenant custom type selected (mutually exclusive with vaccinationTypeId)
        tenantVaccinationTypeConfigId: z.string().uuid().optional(),
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
          tenantVaccinationTypeConfigId: input.tenantVaccinationTypeConfigId,
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
        tenantVaccinationTypeConfigId: z.string().uuid().nullable().optional(),
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
          tenantVaccinationTypeConfigId:
            input.tenantVaccinationTypeConfigId === undefined
              ? undefined
              : input.tenantVaccinationTypeConfigId,
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
    .use(requirePermission(PERMISSIONS.PATIENTS_READ))
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
   * Returns each patient with their vaccinations, type names, reminder status,
   * and overall state. Owners who opted out of email are excluded.
   */
  getPatientSummaryList: tenantProcedure
    .use(requirePermission(PERMISSIONS.PATIENTS_READ))
    .input(
      z.object({
        tenantId: z.string().uuid(),
        hideOptOut: z.boolean().default(true),
        limit: z.number().int().min(1).max(500).default(200),
      })
    )
    .query(async ({ ctx, input }) => {
      const now = new Date();
      const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

      // 1. Fetch all active patients with owner info (filter opt-out if requested)
      const patientRows = await ctx.db
        .select({
          id: patients.id,
          name: patients.name,
          species: patients.species,
          ownerFirstName: owners.firstName,
          ownerLastName: owners.lastName,
          ownerEmailOptOut: owners.emailOptOut,
        })
        .from(patients)
        .leftJoin(owners, eq(patients.ownerId, owners.id))
        .where(
          and(
            eq(patients.tenantId, input.tenantId),
            ne(patients.active, false),
            input.hideOptOut ? ne(owners.emailOptOut, true) : undefined,
          )
        )
        .limit(input.limit);

      if (patientRows.length === 0) return [];

      const patientIds = patientRows.map((p) => p.id);

      // 2. Fetch all non-deleted vaccinations for these patients, joining type names
      const vaccinationRows = await ctx.db
        .select({
          id: vaccinations.id,
          patientId: vaccinations.patientId,
          type: vaccinations.type,
          expiryDate: vaccinations.expiryDate,
          reminderSentDate: vaccinations.reminderSentDate,
          typeName: vaccinationTypes.name,
          typeCategory: vaccinationTypes.category,
        })
        .from(vaccinations)
        .leftJoin(vaccinationTypes, eq(vaccinations.vaccinationTypeId, vaccinationTypes.id))
        .where(
          and(
            inArray(vaccinations.patientId, patientIds),
            isNull(vaccinations.deletedAt),
          )
        )
        .orderBy(asc(vaccinations.expiryDate));

      // 3. Group vaccinations by patientId
      const vacsByPatient = new Map<string, typeof vaccinationRows>();
      for (const v of vaccinationRows) {
        if (!vacsByPatient.has(v.patientId)) vacsByPatient.set(v.patientId, []);
        vacsByPatient.get(v.patientId)!.push(v);
      }

      // 4. Build and sort result
      const result = patientRows.map((patient) => {
        const vacs = vacsByPatient.get(patient.id) ?? [];

        // Find soonest-expiring vaccination for overall state
        let nextDueAt: Date | null = null;
        for (const v of vacs) {
          const d = v.expiryDate as Date | null;
          if (d && (!nextDueAt || d < nextDueAt)) nextDueAt = d;
        }

        let state: "overdue" | "due30" | "current" | "none" = "none";
        let daysUntilDue: number | null = null;
        if (nextDueAt) {
          daysUntilDue = Math.ceil(
            (nextDueAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)
          );
          if (nextDueAt < now) state = "overdue";
          else if (nextDueAt <= in30Days) state = "due30";
          else state = "current";
        }

        return {
          id: patient.id,
          name: patient.name,
          species: patient.species,
          ownerFirstName: patient.ownerFirstName,
          ownerLastName: patient.ownerLastName,
          ownerEmailOptOut: patient.ownerEmailOptOut ?? false,
          nextDueAt,
          state,
          daysUntilDue,
          vaccinations: vacs.map((v) => ({
            id: v.id,
            typeName: v.typeName ?? v.type ?? "Unbekannt",
            category: v.typeCategory ?? null,
            expiryDate: v.expiryDate as Date | null,
            reminderSentDate: v.reminderSentDate as Date | null,
          })),
        };
      });

      // Sort: overdue → due30 → current → none, then by nextDueAt ascending
      const ORDER = { overdue: 0, due30: 1, current: 2, none: 3 } as const;
      return result.sort((a, b) => {
        if (ORDER[a.state] !== ORDER[b.state]) return ORDER[a.state] - ORDER[b.state];
        if (!a.nextDueAt) return 1;
        if (!b.nextDueAt) return -1;
        return a.nextDueAt.getTime() - b.nextDueAt.getTime();
      });
    }),
});
