import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { createTRPCRouter, protectedProcedure } from "@/server/trpc";
import { diagnoses, medications, vitals, patients, users, PERMISSIONS } from "@/lib/db/schema";
import { db as appDb } from "@/lib/db/client";
import { TRPCError } from "@trpc/server";
import { requirePermission } from "@/server/trpc/middleware";
import { writeAuditLog } from "@/server/audit";

async function getUserTenant(ctx: { db: typeof appDb }, userId: string) {
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

// Diagnoses router
const diagnosesRouter = createTRPCRouter({
  list: protectedProcedure
    .input(z.object({ patientId: z.string().uuid(), tenantId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const userTenantId = await getUserTenant(ctx, ctx.userId!);

      if (userTenantId !== input.tenantId) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const [patient] = await ctx.db
        .select()
        .from(patients)
        .where(and(eq(patients.id, input.patientId), eq(patients.tenantId, input.tenantId)))
        .limit(1);

      if (!patient) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      return await ctx.db
        .select()
        .from(diagnoses)
        .where(and(eq(diagnoses.patientId, input.patientId), eq(diagnoses.tenantId, input.tenantId)))
        .orderBy(diagnoses.dateOfDiagnosis);
    }),

  create: protectedProcedure
    .use(requirePermission(PERMISSIONS.MEDICAL_CREATE))
    .input(
      z.object({
        patientId: z.string().uuid(),
        title: z.string().min(1),
        description: z.string().optional(),
        icd10Code: z.string().optional(),
        severity: z.enum(["mild", "moderate", "severe"]).optional(),
        status: z.enum(["active", "resolved", "monitoring"]).default("active"),
        dateOfDiagnosis: z.date(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [user] = await ctx.db
        .select({ id: users.id, tenantId: users.tenantId })
        .from(users)
        .where(eq(users.clerkId, ctx.userId!))
        .limit(1);

      if (!user?.tenantId) {
        throw new TRPCError({ code: "UNAUTHORIZED" });
      }

      const [diagnosis] = await ctx.db
        .insert(diagnoses)
        .values({
          tenantId: user.tenantId,
          patientId: input.patientId,
          vetId: user.id,
          title: input.title,
          description: input.description,
          icd10Code: input.icd10Code,
          severity: input.severity,
          status: input.status,
          dateOfDiagnosis: input.dateOfDiagnosis,
        })
        .returning();

      await writeAuditLog(ctx, {
        tenantId: user.tenantId,
        action: "create",
        entity: { type: "diagnosis", id: diagnosis!.id },
        event: "diagnosis.created",
        summary: "Diagnosis created",
        changes: {
          patientId: input.patientId,
          status: input.status,
          severity: input.severity ?? null,
          dateOfDiagnosis: input.dateOfDiagnosis.toISOString(),
        },
      });

      return diagnosis;
    }),

  update: protectedProcedure
    .use(requirePermission(PERMISSIONS.MEDICAL_UPDATE))
    .input(
      z.object({
        diagnosisId: z.string().uuid(),
        tenantId: z.string().uuid(),
        status: z.enum(["active", "resolved", "monitoring"]).optional(),
        description: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userTenantId = await getUserTenant(ctx, ctx.userId!);

      if (userTenantId !== input.tenantId) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const [diagnosis] = await ctx.db
        .update(diagnoses)
        .set({
          status: input.status,
          description: input.description,
          updatedAt: new Date(),
        })
        .where(and(eq(diagnoses.id, input.diagnosisId), eq(diagnoses.tenantId, input.tenantId)))
        .returning();

      if (!diagnosis) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      await writeAuditLog(ctx, {
        tenantId: input.tenantId,
        action: "update",
        entity: { type: "diagnosis", id: diagnosis.id },
        event: "diagnosis.updated",
        summary: "Diagnosis updated",
        changes: {
          status: input.status,
          descriptionUpdated: input.description !== undefined,
        },
      });

      return diagnosis;
    }),
});

// Medications router
const medicationsRouter = createTRPCRouter({
  list: protectedProcedure
    .input(z.object({ patientId: z.string().uuid(), tenantId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const userTenantId = await getUserTenant(ctx, ctx.userId!);

      if (userTenantId !== input.tenantId) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const [patient] = await ctx.db
        .select()
        .from(patients)
        .where(and(eq(patients.id, input.patientId), eq(patients.tenantId, input.tenantId)))
        .limit(1);

      if (!patient) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      return await ctx.db
        .select()
        .from(medications)
        .where(and(eq(medications.patientId, input.patientId), eq(medications.tenantId, input.tenantId)))
        .orderBy(medications.startDate);
    }),

  create: protectedProcedure
    .input(
      z.object({
        patientId: z.string().uuid(),
        medicationName: z.string().min(1),
        dosage: z.string().min(1),
        frequency: z.string().min(1),
        route: z.enum(["oral", "injection", "topical", "ophthalmic", "other"]).default("oral"),
        startDate: z.date(),
        endDate: z.date().optional(),
        notes: z.string().optional(),
        diagnosisId: z.string().uuid().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [user] = await ctx.db
        .select({ id: users.id, tenantId: users.tenantId })
        .from(users)
        .where(eq(users.clerkId, ctx.userId!))
        .limit(1);

      if (!user?.tenantId) {
        throw new TRPCError({ code: "UNAUTHORIZED" });
      }

      const [medication] = await ctx.db
        .insert(medications)
        .values({
          tenantId: user.tenantId,
          patientId: input.patientId,
          diagnosisId: input.diagnosisId,
          medicationName: input.medicationName,
          dosage: input.dosage,
          frequency: input.frequency,
          route: input.route,
          startDate: input.startDate,
          endDate: input.endDate,
          notes: input.notes,
          prescribedBy: user.id,
        })
        .returning();

      await writeAuditLog(ctx, {
        tenantId: user.tenantId,
        action: "create",
        entity: { type: "medication", id: medication!.id },
        event: "medication.created",
        summary: "Medication created",
        changes: {
          patientId: input.patientId,
          diagnosisId: input.diagnosisId ?? null,
          route: input.route,
          startDate: input.startDate.toISOString(),
          endDate: input.endDate?.toISOString() ?? null,
        },
      });

      return medication;
    }),

  update: protectedProcedure
    .input(
      z.object({
        medicationId: z.string().uuid(),
        tenantId: z.string().uuid(),
        endDate: z.date().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userTenantId = await getUserTenant(ctx, ctx.userId!);

      if (userTenantId !== input.tenantId) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const [medication] = await ctx.db
        .update(medications)
        .set({
          endDate: input.endDate,
          notes: input.notes,
          updatedAt: new Date(),
        })
        .where(and(eq(medications.id, input.medicationId), eq(medications.tenantId, input.tenantId)))
        .returning();

      if (!medication) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      await writeAuditLog(ctx, {
        tenantId: input.tenantId,
        action: "update",
        entity: { type: "medication", id: medication.id },
        event: "medication.updated",
        summary: "Medication updated",
        changes: {
          endDate: input.endDate?.toISOString() ?? null,
          notesUpdated: input.notes !== undefined,
        },
      });

      return medication;
    }),
});

// Vitals router
const vitalsRouter = createTRPCRouter({
  list: protectedProcedure
    .input(z.object({ patientId: z.string().uuid(), tenantId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const userTenantId = await getUserTenant(ctx, ctx.userId!);

      if (userTenantId !== input.tenantId) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const [patient] = await ctx.db
        .select()
        .from(patients)
        .where(and(eq(patients.id, input.patientId), eq(patients.tenantId, input.tenantId)))
        .limit(1);

      if (!patient) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      return await ctx.db
        .select()
        .from(vitals)
        .where(and(eq(vitals.patientId, input.patientId), eq(vitals.tenantId, input.tenantId)))
        .orderBy(vitals.recordedAt);
    }),

  create: protectedProcedure
    .input(
      z.object({
        patientId: z.string().uuid(),
        tenantId: z.string().uuid(),
        weight: z.number().int().positive().optional(),
        temperature: z.string().optional(),
        heartRate: z.number().int().optional(),
        respiratoryRate: z.number().int().optional(),
        notes: z.string().optional(),
        recordedAt: z.date().default(() => new Date()),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [user] = await ctx.db
        .select({ id: users.id, tenantId: users.tenantId })
        .from(users)
        .where(eq(users.clerkId, ctx.userId!))
        .limit(1);

      if (!user?.tenantId || user.tenantId !== input.tenantId) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const [vital] = await ctx.db
        .insert(vitals)
        .values({
          tenantId: user.tenantId,
          patientId: input.patientId,
          recordedBy: user.id,
          weight: input.weight,
          temperature: input.temperature,
          heartRate: input.heartRate,
          respiratoryRate: input.respiratoryRate,
          notes: input.notes,
          recordedAt: input.recordedAt,
        })
        .returning();

      await writeAuditLog(ctx, {
        tenantId: user.tenantId,
        action: "create",
        entity: { type: "vital", id: vital!.id },
        event: "vital.created",
        summary: "Vitals recorded",
        changes: {
          patientId: input.patientId,
          recordedAt: input.recordedAt.toISOString(),
          hasWeight: input.weight !== undefined,
          hasTemperature: input.temperature !== undefined,
          hasHeartRate: input.heartRate !== undefined,
          hasRespiratoryRate: input.respiratoryRate !== undefined,
        },
      });

      return vital;
    }),
});

// Allergies router
const allergiesRouter = createTRPCRouter({
  update: protectedProcedure
    .input(
      z.object({
        patientId: z.string().uuid(),
        tenantId: z.string().uuid(),
        allergies: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userTenantId = await getUserTenant(ctx, ctx.userId!);

      if (userTenantId !== input.tenantId) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const [patient] = await ctx.db
        .update(patients)
        .set({ allergies: input.allergies })
        .where(and(eq(patients.id, input.patientId), eq(patients.tenantId, input.tenantId)))
        .returning();

      if (!patient) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      await writeAuditLog(ctx, {
        tenantId: input.tenantId,
        action: "update",
        entity: { type: "patient", id: patient.id },
        event: "patient.allergies_updated",
        summary: "Patient allergies updated",
        changes: {
          hasAllergiesText: Boolean(input.allergies && input.allergies.trim().length > 0),
        },
      });

      return patient;
    }),
});

// Main medical router
export const medicalRouter = createTRPCRouter({
  diagnoses: diagnosesRouter,
  medications: medicationsRouter,
  vitals: vitalsRouter,
  allergies: allergiesRouter,
});
