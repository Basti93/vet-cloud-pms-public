/**
 * Email Router
 * tRPC procedures for sending appointment confirmation & cancellation emails
 */

import { z } from 'zod';
import { createTRPCRouter, protectedProcedure } from '@/server/trpc';
import { users, emailSettings, tenants } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { sendConfirmationEmail, SendConfirmationEmailInput } from '@/lib/email/service';
import { getSystemDomain } from '@/lib/system-name';

const FIXED_REMINDER_HOURS = 24;

export const emailRouter = createTRPCRouter({
  // TODO: Re-implement sendConfirmationEmail and sendCancellationEmail with new email settings
  // These will use the new sendConfirmationEmail function from the service and respect email settings

  /**
   * Get email settings for a tenant
   */
  getSettings: protectedProcedure
    .input(z.object({ tenantId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      try {
        // Verify user belongs to this tenant
        const [user] = await ctx.db
          .select({ tenantId: users.tenantId })
          .from(users)
          .where(eq(users.clerkId, ctx.userId!))
          .limit(1);

        if (user?.tenantId !== input.tenantId) {
          throw new TRPCError({ code: 'FORBIDDEN' });
        }

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

        return settings;
      } catch (error) {
        console.error('Error in getSettings:', error);
        throw error;
      }
    }),

  /**
   * Update email settings for a tenant
   */
  updateSettings: protectedProcedure
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
      // Verify user has permission
      const [user] = await ctx.db
        .select({ tenantId: users.tenantId })
        .from(users)
        .where(eq(users.clerkId, ctx.userId!))
        .limit(1);

      if (user?.tenantId !== input.tenantId) {
        throw new TRPCError({ code: 'FORBIDDEN' });
      }

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
  sendTestEmail: protectedProcedure
    .input(
      z.object({
        tenantId: z.string().uuid(),
        recipientEmail: z.string().email(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify user belongs to this tenant
      const [user] = await ctx.db
        .select({ tenantId: users.tenantId })
        .from(users)
        .where(eq(users.clerkId, ctx.userId!))
        .limit(1);

      if (user?.tenantId !== input.tenantId) {
        throw new TRPCError({ code: 'FORBIDDEN' });
      }

      // Get tenant name for test email
      const [tenant] = await ctx.db
        .select({ name: tenants.name })
        .from(tenants)
        .where(eq(tenants.id, input.tenantId))
        .limit(1);

      if (!tenant) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Praxis nicht gefunden' });
      }

      // Send test email
      const testEmailData: SendConfirmationEmailInput = {
        to: input.recipientEmail,
        practiceName: tenant.name,
        ownerFirstName: 'Max',
        patientName: 'Bella',
        patientSpecies: 'Hund',
        appointmentDate: new Date().toLocaleDateString('de-DE'),
        appointmentTime: '14:30',
        appointmentDateTime: `${new Date().toLocaleDateString('de-DE')} um 14:30 Uhr`,
        vetName: 'Dr. Schmidt',
      };

      const result = await sendConfirmationEmail(testEmailData);

      if (!result.success) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Email konnte nicht gesendet werden: ${JSON.stringify(result.error)}`,
        });
      }

      return { success: true, messageId: result.messageId };
    }),
});
