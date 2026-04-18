import { z } from "zod";
import { eq } from "drizzle-orm";
import { createTRPCRouter, protectedProcedure } from "@/server/trpc";
import { diagnoses, medications, vitals, patients, users } from "@/lib/db/schema";
import { TRPCError } from "@trpc/server";

// Diagnoses router
const diagnosesRouter = createTRPCRouter({
  list: protectedProcedure
    .input(z.object({ patientId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return await ctx.db
        .select()
        .from(diagnoses)
        .where(eq(diagnoses.patientId, input.patientId))
        .orderBy(diagnoses.dateOfDiagnosis);
    }),

  create: protectedProcedure
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

      return diagnosis;
    }),

  update: protectedProcedure
    .input(
      z.object({
        diagnosisId: z.string().uuid(),
        status: z.enum(["active", "resolved", "monitoring"]).optional(),
        description: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [diagnosis] = await ctx.db
        .update(diagnoses)
        .set({
          status: input.status,
          description: input.description,
          updatedAt: new Date(),
        })
        .where(eq(diagnoses.id, input.diagnosisId))
        .returning();

      return diagnosis;
    }),
});

// Medications router
const medicationsRouter = createTRPCRouter({
  list: protectedProcedure
    .input(z.object({ patientId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return await ctx.db
        .select()
        .from(medications)
        .where(eq(medications.patientId, input.patientId))
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

      return medication;
    }),

  update: protectedProcedure
    .input(
      z.object({
        medicationId: z.string().uuid(),
        endDate: z.date().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [medication] = await ctx.db
        .update(medications)
        .set({
          endDate: input.endDate,
          notes: input.notes,
          updatedAt: new Date(),
        })
        .where(eq(medications.id, input.medicationId))
        .returning();

      return medication;
    }),
});

// Vitals router
const vitalsRouter = createTRPCRouter({
  list: protectedProcedure
    .input(z.object({ patientId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return await ctx.db
        .select()
        .from(vitals)
        .where(eq(vitals.patientId, input.patientId))
        .orderBy(vitals.recordedAt);
    }),

  create: protectedProcedure
    .input(
      z.object({
        patientId: z.string().uuid(),
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

      if (!user?.tenantId) {
        throw new TRPCError({ code: "UNAUTHORIZED" });
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

      return vital;
    }),
});

// Allergies router
const allergiesRouter = createTRPCRouter({
  update: protectedProcedure
    .input(
      z.object({
        patientId: z.string().uuid(),
        allergies: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [patient] = await ctx.db
        .update(patients)
        .set({ allergies: input.allergies })
        .where(eq(patients.id, input.patientId))
        .returning();

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
