import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { PERMISSIONS, tenants, vaccinationSettings } from "@/lib/db/schema";
import { sendVaccinationReminderEmail } from "@/lib/email/service";
import { getMainDomain } from "@/lib/env";
import { createTRPCRouter, tenantProcedure } from "@/server/trpc";
import { requirePermission } from "@/server/trpc/middleware";

const defaultSettings = {
  reminderEnabled: true,
  reminderDaysBefore: 30,
  remindCore: true,
  remindRecommended: true,
  remindOptional: false,
  remindOverdue: true,
  reminderSubject: "Impf-Erinnerung für {petName}",
  reminderBody:
    "Hallo {ownerName},\n\nfür {petName} ist die Auffrischung ({vaccinationType}) am {dueDate} fällig.\nBitte vereinbaren Sie einen Termin bei {clinicName}.\n\nViele Grüße\n{clinicName}",
};

export const vaccinationSettingsRouter = createTRPCRouter({
  get: tenantProcedure
    .use(requirePermission(PERMISSIONS.SETTINGS_MANAGE))
    .input(z.object({ tenantId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [settings] = await ctx.db
        .select()
        .from(vaccinationSettings)
        .where(eq(vaccinationSettings.tenantId, input.tenantId))
        .limit(1);

      if (settings) return settings;

      return {
        tenantId: input.tenantId,
        ...defaultSettings,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }),

  update: tenantProcedure
    .use(requirePermission(PERMISSIONS.SETTINGS_MANAGE))
    .input(
      z.object({
        tenantId: z.string().uuid(),
        reminderEnabled: z.boolean(),
        reminderDaysBefore: z.number().int().min(1).max(365),
        remindCore: z.boolean(),
        remindRecommended: z.boolean(),
        remindOptional: z.boolean(),
        remindOverdue: z.boolean(),
        reminderSubject: z.string().trim().min(1).max(255),
        reminderBody: z.string().trim().min(1).max(5000),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const values = {
        tenantId: input.tenantId,
        reminderEnabled: input.reminderEnabled,
        reminderDaysBefore: input.reminderDaysBefore,
        remindCore: input.remindCore,
        remindRecommended: input.remindRecommended,
        remindOptional: input.remindOptional,
        remindOverdue: input.remindOverdue,
        reminderSubject: input.reminderSubject,
        reminderBody: input.reminderBody,
      };

      const [result] = await ctx.db
        .insert(vaccinationSettings)
        .values(values)
        .onConflictDoUpdate({
          target: vaccinationSettings.tenantId,
          set: { ...values, updatedAt: new Date() },
        })
        .returning();

      return result;
    }),

  sendTestReminder: tenantProcedure
    .use(requirePermission(PERMISSIONS.SETTINGS_MANAGE))
    .input(
      z.object({
        tenantId: z.string().uuid(),
        emailAddress: z.string().email(),
      })
    )
    .mutation(async ({ input }) => {
      const [tenant] = await db
        .select({ id: tenants.id, name: tenants.name, slug: tenants.slug })
        .from(tenants)
        .where(eq(tenants.id, input.tenantId))
        .limit(1);

      if (!tenant) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Tenant not found" });
      }

      const [settings] = await db
        .select()
        .from(vaccinationSettings)
        .where(eq(vaccinationSettings.tenantId, input.tenantId))
        .limit(1);

      const result = await sendVaccinationReminderEmail({
        tenantId: input.tenantId,
        vaccinationId: "test",
        ownerEmail: input.emailAddress,
        ownerName: "Max Mustermann",
        petName: "Bello",
        vaccinationType: "Tollwut",
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        clinicName: tenant.name,
        bookingUrl: `${getMainDomain()}/book/${tenant.slug}`,
        customSubject: settings?.reminderSubject ?? defaultSettings.reminderSubject,
        customBody: settings?.reminderBody ?? defaultSettings.reminderBody,
      });

      return {
        success: result.success,
        messageId: result.messageId,
        error: result.success ? undefined : String(result.error),
      };
    }),
});
