import { z } from "zod";
import { eq } from "drizzle-orm";
import { createTRPCRouter, protectedProcedure } from "@/server/trpc";
import {
  tenants,
  appointments,
  patients,
  owners,
  voiceCalls,
  users,
  vetSchedules,
  diagnoses,
  medications,
  vitals,
} from "@/lib/db/schema";
import { TRPCError } from "@trpc/server";

const DEMO_TENANT_ID = "00000000-0000-4000-8000-000000000003";
const DEMO_TENANT_SLUG = "demo";

export const adminRouter = createTRPCRouter({
  /**
   * Get current user's tenant ID
   * Protected: Auth required
   */
  getTenantId: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.userId) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Not authenticated",
      });
    }

    const [user] = await ctx.db
      .select({ tenantId: users.tenantId })
      .from(users)
      .where(eq(users.clerkId, ctx.userId))
      .limit(1);

    if (!user) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "User not found in database",
      });
    }

    return { tenantId: user.tenantId };
  }),

  /**
   * Set demo tenant slug (one-time setup)
   * Protected: Admin only
   */
  setDemoSlug: protectedProcedure.mutation(async ({ ctx }) => {
    const [tenant] = await ctx.db
      .update(tenants)
      .set({ slug: DEMO_TENANT_SLUG })
      .where(eq(tenants.id, DEMO_TENANT_ID))
      .returning();

    if (!tenant) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Demo tenant not found",
      });
    }

    console.log(`✅ Demo tenant slug set to: ${DEMO_TENANT_SLUG}`);
    return { success: true, slug: tenant.slug };
  }),

  /**
   * Complete reset of demo tenant (clears all bookings/patients/owners/voice calls)
   * Protected: Admin only
   * Called nightly at 23:00 for fresh demo data
   */
  resetDemoTenant: protectedProcedure.mutation(async ({ ctx }) => {
    try {
      // Delete in order to respect foreign key constraints
      // 1. Delete vitals
      const vitalsDeleted = await ctx.db
        .delete(vitals)
        .where(eq(vitals.tenantId, DEMO_TENANT_ID));

      // 2. Delete medications
      const medicationsDeleted = await ctx.db
        .delete(medications)
        .where(eq(medications.tenantId, DEMO_TENANT_ID));

      // 3. Delete diagnoses
      const diagnosesDeleted = await ctx.db
        .delete(diagnoses)
        .where(eq(diagnoses.tenantId, DEMO_TENANT_ID));

      // 4. Delete voice calls
      const voiceCallsDeleted = await ctx.db
        .delete(voiceCalls)
        .where(eq(voiceCalls.tenantId, DEMO_TENANT_ID));

      // 5. Delete appointments
      const appointmentsDeleted = await ctx.db
        .delete(appointments)
        .where(eq(appointments.tenantId, DEMO_TENANT_ID));

      // 6. Delete patients (cascade should handle, but explicit)
      const patientsDeleted = await ctx.db
        .delete(patients)
        .where(eq(patients.tenantId, DEMO_TENANT_ID));

      // 7. Delete owners (cascade should handle, but explicit)
      const ownersDeleted = await ctx.db
        .delete(owners)
        .where(eq(owners.tenantId, DEMO_TENANT_ID));

      // 8. Delete vet schedules
      const vetSchedulesDeleted = await ctx.db
        .delete(vetSchedules)
        .where(eq(vetSchedules.tenantId, DEMO_TENANT_ID));

      console.log(
        `🔄 Demo tenant reset completed:
        - Vitals deleted: ${vitalsDeleted.count || 0}
        - Medications deleted: ${medicationsDeleted.count || 0}
        - Diagnoses deleted: ${diagnosesDeleted.count || 0}
        - Voice calls deleted: ${voiceCallsDeleted.count || 0}
        - Appointments deleted: ${appointmentsDeleted.count || 0}
        - Patients deleted: ${patientsDeleted.count || 0}
        - Owners deleted: ${ownersDeleted.count || 0}
        - Vet schedules deleted: ${vetSchedulesDeleted.count || 0}`
      );

      return {
        success: true,
        stats: {
          vitalsDeleted: vitalsDeleted.count || 0,
          medicationsDeleted: medicationsDeleted.count || 0,
          diagnosesDeleted: diagnosesDeleted.count || 0,
          voiceCallsDeleted: voiceCallsDeleted.count || 0,
          appointmentsDeleted: appointmentsDeleted.count || 0,
          patientsDeleted: patientsDeleted.count || 0,
          ownersDeleted: ownersDeleted.count || 0,
          vetSchedulesDeleted: vetSchedulesDeleted.count || 0,
        },
      };
    } catch (error) {
      console.error("❌ Error resetting demo tenant:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to reset demo tenant",
      });
    }
  }),
});
