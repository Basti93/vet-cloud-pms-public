import { z } from "zod";
import { eq } from "drizzle-orm";
import { createTRPCRouter, tenantProcedure } from "@/server/trpc";
import { emailSettings, tenants } from "@/lib/db/schema";
import { TRPCError } from "@trpc/server";
import { requirePermission } from "@/server/trpc/middleware";
import { PERMISSIONS } from "@/lib/db/schema";
import { sendConfirmationEmail, SendConfirmationEmailInput } from "@/lib/email/service";

const FIXED_REMINDER_HOURS = 24;

export const emailSettingsRouter = createTRPCRouter({
  // ── Get Settings ────────────────────────────────────────────────────────
  get: tenantProcedure
    .use(requirePermission(PERMISSIONS.SETTINGS_MANAGE))
    .input(z.object({ tenantId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [settings] = await ctx.db
        .select()
        .from(emailSettings)
        .where(eq(emailSettings.tenantId, input.tenantId))
        .limit(1);

      if (!settings) {
        const [created] = await ctx.db
          .insert(emailSettings)
          .values({ tenantId: input.tenantId })
          .returning();
        return created;
      }

      return settings;
    }),

  // ── Update Settings ─────────────────────────────────────────────────────
  update: tenantProcedure
    .use(requirePermission(PERMISSIONS.SETTINGS_MANAGE))
    .input(
      z.object({
        tenantId: z.string().uuid(),
        confirmationEmailEnabled: z.boolean().optional(),
        reminderEmailEnabled: z.boolean().optional(),
        reminderHoursBefore: z.number().int().min(1).max(168).optional(),
        bookingNotificationEnabled: z.boolean().optional(),
        senderName: z.string().max(100).optional(),
        confirmationSubject: z.string().max(255).optional(),
        confirmationBody: z.string().optional(),
        reminderSubject: z.string().max(255).optional(),
        reminderBody: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { tenantId, ...updateData } = input;
      const normalizedUpdateData = {
        ...updateData,
        reminderHoursBefore: FIXED_REMINDER_HOURS,
      };

      const [existing] = await ctx.db
        .select()
        .from(emailSettings)
        .where(eq(emailSettings.tenantId, tenantId))
        .limit(1);

      if (!existing) {
        const [created] = await ctx.db
          .insert(emailSettings)
          .values({ tenantId, ...normalizedUpdateData })
          .returning();
        return created;
      }

      const [updated] = await ctx.db
        .update(emailSettings)
        .set({ ...normalizedUpdateData, updatedAt: new Date() })
        .where(eq(emailSettings.tenantId, tenantId))
        .returning();

      return updated;
    }),

  // ── Send Test Email ─────────────────────────────────────────────────────
  sendTestEmail: tenantProcedure
    .use(requirePermission(PERMISSIONS.SETTINGS_MANAGE))
    .input(
      z.object({
        tenantId: z.string().uuid(),
        type: z.enum(["confirmation", "reminder"]),
        recipientEmail: z.string().email(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [tenant] = await ctx.db
        .select({ name: tenants.name })
        .from(tenants)
        .where(eq(tenants.id, input.tenantId))
        .limit(1);

      if (!tenant) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Tenant not found" });
      }

      const testEmailData: SendConfirmationEmailInput = {
        to: input.recipientEmail,
        practiceName: tenant.name,
        ownerFirstName: "Max",
        patientName: "Bella",
        patientSpecies: "Hund",
        appointmentDate: "20. April 2026",
        appointmentTime: "14:30",
        appointmentDateTime: "20. April 2026 um 14:30 Uhr",
        vetName: "Dr. Schmidt",
      };

      const result = await sendConfirmationEmail(testEmailData);

      if (!result.success) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to send test email: ${JSON.stringify(result.error)}`,
        });
      }

      return { success: true, messageId: result.messageId };
    }),
});
