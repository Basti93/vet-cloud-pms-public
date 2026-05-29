/**
 * Email Router
 * tRPC procedures for sending appointment confirmation & cancellation emails
 */

import { z } from 'zod';
import { createTRPCRouter, tenantProcedure } from '@/server/trpc';
import { emailSettings, tenants } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { getProviderForTenant } from '@/lib/email/providers';
import { getSystemDomain } from '@/lib/system-name';
import { encryptSecret } from '@/lib/crypto';

const FIXED_REMINDER_HOURS = 24;

export const emailRouter = createTRPCRouter({
  // TODO: Re-implement sendConfirmationEmail and sendCancellationEmail with new email settings
  // These will use the new sendConfirmationEmail function from the service and respect email settings

  /**
   * Get email settings for a tenant
   */
  getSettings: tenantProcedure
    .input(z.object({ tenantId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      try {
        let [settings] = await ctx.db
          .select()
          .from(emailSettings)
          .where(eq(emailSettings.tenantId, input.tenantId))
          .limit(1);

        // If no settings exist, create defaults
        if (!settings) {
          console.log('Creating default email settings for tenant:', input.tenantId);
          const created = await ctx.db
            .insert(emailSettings)
            .values({
              tenantId: input.tenantId,
              confirmationEmailEnabled: true,
              reminderEmailEnabled: true,
              reminderHoursBefore: 24,
              bookingNotificationEnabled: true,
              senderName: getSystemDomain(),
            })
            .returning();

          settings = created[0];
          console.log('Created settings:', settings);
        }

        const { smtpPassEncrypted, ...rest } = settings;
        return {
          ...rest,
          smtpPassMasked: smtpPassEncrypted ? '••••••••' : null,
        };
      } catch (error) {
        console.error('Error in getSettings:', error);
        throw error;
      }
    }),

  /**
   * Update email settings for a tenant
   */
  updateSettings: tenantProcedure
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
        smtpEnabled: z.boolean().optional(),
        smtpHost: z.string().max(255).optional(),
        smtpPort: z.number().int().min(1).max(65535).optional(),
        smtpUser: z.string().max(255).optional(),
        smtpPass: z.string().optional(),
        smtpFromEmail: z.string().email().max(255).optional().or(z.literal('')),
        smtpFromName: z.string().max(100).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { tenantId, smtpPass, smtpFromEmail, ...rest } = input;

      const smtpUpdate: Record<string, unknown> = {};
      if (smtpPass && smtpPass.length > 0) {
        smtpUpdate.smtpPassEncrypted = encryptSecret(smtpPass);
      }
      if (smtpFromEmail !== undefined) {
        smtpUpdate.smtpFromEmail = smtpFromEmail === '' ? null : smtpFromEmail;
      }

      const normalizedUpdateData = {
        ...rest,
        ...smtpUpdate,
        reminderHoursBefore: FIXED_REMINDER_HOURS,
      };

      const [existing] = await ctx.db
        .select()
        .from(emailSettings)
        .where(eq(emailSettings.tenantId, tenantId))
        .limit(1);

      if (!existing) {
        // Create if doesn't exist
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

  /**
   * Send test confirmation email
   */
  sendTestEmail: tenantProcedure
    .input(
      z.object({
        tenantId: z.string().uuid(),
        recipientEmail: z.string().email(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Get tenant name for test email
      const [tenant] = await ctx.db
        .select({ name: tenants.name })
        .from(tenants)
        .where(eq(tenants.id, input.tenantId))
        .limit(1);

      if (!tenant) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Praxis nicht gefunden' });
      }

      // Resolve provider (tenant SMTP if configured, else system)
      const { provider, from: customFrom } = await getProviderForTenant(input.tenantId);
      const from = customFrom ?? `${tenant.name} <${process.env.SMTP_FROM ?? 'noreply@example.com'}>`;

      let result: { success: boolean; messageId?: string; error?: unknown };
      try {
        const { messageId } = await provider.send({
          from,
          to: input.recipientEmail,
          subject: `Testmail von ${tenant.name}`,
          text: `Dies ist eine Testmail von ${tenant.name}.\n\nWenn Sie diese E-Mail erhalten haben, funktioniert Ihre E-Mail-Konfiguration korrekt.`,
        });
        result = { success: true, messageId };
      } catch (error) {
        result = { success: false, error };
      }

      if (!result.success) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Email konnte nicht gesendet werden: ${JSON.stringify(result.error)}`,
        });
      }

      return { success: true, messageId: result.messageId };
    }),
});
