/**
 * Medical Router — clinical records for patients within a tenant.
 *
 * Sub-domains:
 *   diagnoses  — ICD-10 coded diagnoses with severity + lifecycle status
 *   medications — prescriptions linked optionally to a diagnosis
 *   vitals     — weight, temperature, heart rate, respiratory rate snapshots
 *   allergies  — free-text allergy notes stored on the patient record
 *
 * Security model:
 *   - All procedures are `tenantProcedure` → requires Clerk session, active
 *     tenant, and input.tenantId === ctx.tenantId (cross-tenant access blocked).
 *   - Mutations require MEDICAL_CREATE or MEDICAL_UPDATE permission (Vet+ only;
 *     Receptionist role has no MEDICAL_* permissions).
 *   - Every create/update verifies the patientId belongs to the authenticated
 *     tenant before writing, preventing cross-patient injection.
 *   - All mutations write to the immutable audit log for DSGVO compliance.
 *
 * Security model note:
 *   - All list procedures now require MEDICAL_READ (added 2026-05-23).
 *     Receptionist role has no MEDICAL_* permissions and cannot read records.
 */

import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { createTRPCRouter, tenantProcedure } from "@/server/trpc";
import { diagnoses, medications, vitals, patients, PERMISSIONS } from "@/lib/db/schema";
import { TRPCError } from "@trpc/server";
import { requirePermission } from "@/server/trpc/middleware";
import { auditedMutation } from "@/server/trpc/audited-mutation";

// ── Diagnoses ─────────────────────────────────────────────────────────────────

const diagnosesRouter = createTRPCRouter({
  list: tenantProcedure
    .use(requirePermission(PERMISSIONS.MEDICAL_READ))
    .input(z.object({ patientId: z.string().uuid(), tenantId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [patient] = await ctx.db
        .select()
        .from(patients)
        .where(and(eq(patients.id, input.patientId), eq(patients.tenantId, input.tenantId)))
        .limit(1);

      if (!patient) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      return ctx.db
        .select()
        .from(diagnoses)
        .where(and(eq(diagnoses.patientId, input.patientId), eq(diagnoses.tenantId, input.tenantId)))
        .orderBy(diagnoses.dateOfDiagnosis);
    }),

  create: auditedMutation({
    entity: "diagnosis",
    event: "diagnosis.created",
    action: "create",
    summary: "Diagnosis created",
    entityId: (result) => (result as { id: string }).id,
    changes: (_result, input) => {
      const data = input as {
        patientId: string;
        status: string;
        severity?: string;
        dateOfDiagnosis: Date;
      };
      return {
        patientId: data.patientId,
        status: data.status,
        severity: data.severity ?? null,
        dateOfDiagnosis: data.dateOfDiagnosis.toISOString(),
      };
    },
  })
    .use(requirePermission(PERMISSIONS.MEDICAL_CREATE))
    .input(
      z.object({
        tenantId: z.string().uuid(),
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
      const { tenantId, dbUserId } = ctx as { tenantId: string; dbUserId: string };

      const [patient] = await ctx.db
        .select({ id: patients.id })
        .from(patients)
        .where(and(eq(patients.id, input.patientId), eq(patients.tenantId, tenantId)))
        .limit(1);

      if (!patient) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Patient not found" });
      }

      const [diagnosis] = await ctx.db
        .insert(diagnoses)
        .values({
          tenantId,
          patientId: input.patientId,
          vetId: dbUserId,
          title: input.title,
          description: input.description,
          icd10Code: input.icd10Code,
          severity: input.severity,
          status: input.status,
          dateOfDiagnosis: input.dateOfDiagnosis,
        })
        .returning();

      return diagnosis;
    }),

  update: auditedMutation({
    entity: "diagnosis",
    event: "diagnosis.updated",
    action: "update",
    summary: "Diagnosis updated",
    entityId: (result) => (result as { id: string }).id,
    changes: (_result, input) => {
      const data = input as { status?: string; description?: string };
      return {
        status: data.status,
        descriptionUpdated: data.description !== undefined,
      };
    },
  })
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
      const [diagnosis] = await ctx.db
        .update(diagnoses)
        .set({ status: input.status, description: input.description, updatedAt: new Date() })
        .where(and(eq(diagnoses.id, input.diagnosisId), eq(diagnoses.tenantId, input.tenantId)))
        .returning();

      if (!diagnosis) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      return diagnosis;
    }),
});

// ── Medications ───────────────────────────────────────────────────────────────

const medicationsRouter = createTRPCRouter({
  list: tenantProcedure
    .use(requirePermission(PERMISSIONS.MEDICAL_READ))
    .input(z.object({ patientId: z.string().uuid(), tenantId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [patient] = await ctx.db
        .select()
        .from(patients)
        .where(and(eq(patients.id, input.patientId), eq(patients.tenantId, input.tenantId)))
        .limit(1);

      if (!patient) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      return ctx.db
        .select()
        .from(medications)
        .where(and(eq(medications.patientId, input.patientId), eq(medications.tenantId, input.tenantId)))
        .orderBy(medications.startDate);
    }),

  create: auditedMutation({
    entity: "medication",
    event: "medication.created",
    action: "create",
    summary: "Medication created",
    entityId: (result) => (result as { id: string }).id,
    changes: (_result, input) => {
      const data = input as {
        patientId: string;
        diagnosisId?: string;
        route: string;
        startDate: Date;
        endDate?: Date;
      };
      return {
        patientId: data.patientId,
        diagnosisId: data.diagnosisId ?? null,
        route: data.route,
        startDate: data.startDate.toISOString(),
        endDate: data.endDate?.toISOString() ?? null,
      };
    },
  })
    .use(requirePermission(PERMISSIONS.MEDICAL_CREATE))
    .input(
      z.object({
        tenantId: z.string().uuid(),
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
      const { tenantId, dbUserId } = ctx as { tenantId: string; dbUserId: string };

      const [patient] = await ctx.db
        .select({ id: patients.id })
        .from(patients)
        .where(and(eq(patients.id, input.patientId), eq(patients.tenantId, tenantId)))
        .limit(1);

      if (!patient) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Patient not found" });
      }

      const [medication] = await ctx.db
        .insert(medications)
        .values({
          tenantId,
          patientId: input.patientId,
          diagnosisId: input.diagnosisId,
          medicationName: input.medicationName,
          dosage: input.dosage,
          frequency: input.frequency,
          route: input.route,
          startDate: input.startDate,
          endDate: input.endDate,
          notes: input.notes,
          prescribedBy: dbUserId,
        })
        .returning();

      return medication;
    }),

  update: auditedMutation({
    entity: "medication",
    event: "medication.updated",
    action: "update",
    summary: "Medication updated",
    entityId: (result) => (result as { id: string }).id,
    changes: (_result, input) => {
      const data = input as { endDate?: Date; notes?: string };
      return {
        endDate: data.endDate?.toISOString() ?? null,
        notesUpdated: data.notes !== undefined,
      };
    },
  })
    .use(requirePermission(PERMISSIONS.MEDICAL_UPDATE))
    .input(
      z.object({
        medicationId: z.string().uuid(),
        tenantId: z.string().uuid(),
        endDate: z.date().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [medication] = await ctx.db
        .update(medications)
        .set({ endDate: input.endDate, notes: input.notes, updatedAt: new Date() })
        .where(and(eq(medications.id, input.medicationId), eq(medications.tenantId, input.tenantId)))
        .returning();

      if (!medication) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      return medication;
    }),
});

// ── Vitals ────────────────────────────────────────────────────────────────────

const vitalsRouter = createTRPCRouter({
  list: tenantProcedure
    .use(requirePermission(PERMISSIONS.MEDICAL_READ))
    .input(z.object({ patientId: z.string().uuid(), tenantId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [patient] = await ctx.db
        .select()
        .from(patients)
        .where(and(eq(patients.id, input.patientId), eq(patients.tenantId, input.tenantId)))
        .limit(1);

      if (!patient) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      return ctx.db
        .select()
        .from(vitals)
        .where(and(eq(vitals.patientId, input.patientId), eq(vitals.tenantId, input.tenantId)))
        .orderBy(vitals.recordedAt);
    }),

  create: auditedMutation({
    entity: "vital",
    event: "vital.created",
    action: "create",
    summary: "Vitals recorded",
    entityId: (result) => (result as { id: string }).id,
    changes: (_result, input) => {
      const data = input as {
        patientId: string;
        recordedAt: Date;
        weight?: number;
        temperature?: string;
        heartRate?: number;
        respiratoryRate?: number;
      };
      return {
        patientId: data.patientId,
        recordedAt: data.recordedAt.toISOString(),
        hasWeight: data.weight !== undefined,
        hasTemperature: data.temperature !== undefined,
        hasHeartRate: data.heartRate !== undefined,
        hasRespiratoryRate: data.respiratoryRate !== undefined,
      };
    },
  })
    .use(requirePermission(PERMISSIONS.MEDICAL_CREATE))
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
      const { dbUserId } = ctx as { dbUserId: string };

      const [patient] = await ctx.db
        .select({ id: patients.id })
        .from(patients)
        .where(and(eq(patients.id, input.patientId), eq(patients.tenantId, input.tenantId)))
        .limit(1);

      if (!patient) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Patient not found" });
      }

      const [vital] = await ctx.db
        .insert(vitals)
        .values({
          tenantId: input.tenantId,
          patientId: input.patientId,
          recordedBy: dbUserId,
          weight: input.weight,
          temperature: input.temperature,
          heartRate: input.heartRate,
          respiratoryRate: input.respiratoryRate,
          notes: input.notes,
          recordedAt: input.recordedAt,
        })
        .returning();

      return vital;
    }),
});

// ── Allergies ─────────────────────────────────────────────────────────────────

// Stored as free-text on the patient record (not a separate table) — intentionally
// simple for MVP. Structured allergy records (substance, reaction, severity) can
// be added later without a breaking schema change.
const allergiesRouter = createTRPCRouter({
  update: auditedMutation({
    entity: "patient",
    event: "patient.allergies_updated",
    action: "update",
    summary: "Patient allergies updated",
    entityId: (result) => (result as { id: string }).id,
    changes: (_result, input) => {
      const data = input as { allergies?: string };
      return {
        hasAllergiesText: Boolean(data.allergies && data.allergies.trim().length > 0),
      };
    },
  })
    .use(requirePermission(PERMISSIONS.MEDICAL_UPDATE))
    .input(
      z.object({
        patientId: z.string().uuid(),
        tenantId: z.string().uuid(),
        allergies: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [patient] = await ctx.db
        .update(patients)
        .set({ allergies: input.allergies })
        .where(and(eq(patients.id, input.patientId), eq(patients.tenantId, input.tenantId)))
        .returning();

      if (!patient) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      return patient;
    }),
});

// ── Exports ───────────────────────────────────────────────────────────────────

export const medicalRouter = createTRPCRouter({
  diagnoses: diagnosesRouter,
  medications: medicationsRouter,
  vitals: vitalsRouter,
  allergies: allergiesRouter,
});
