/**
 * Email Router
 * tRPC procedures for sending appointment confirmation & cancellation emails
 */

import { z } from 'zod';
import { createTRPCRouter, protectedProcedure, publicProcedure } from '@/server/trpc';
import { appointments, owners, patients, users } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { sendTemplateEmail } from '@/lib/email/service';
import { confirmationTemplate, cancellationTemplate } from '@/lib/email/templates';
import { generateConfirmationToken, buildConfirmationUrl } from '@/lib/tokens/confirmation';

export const emailRouter = createTRPCRouter({
  /**
   * Protected: Send confirmation email after booking
   * Called after appointment is created in the booking flow
   */
  sendConfirmationEmail: protectedProcedure
    .input(
      z.object({
        appointmentId: z.string().uuid(),
        tenantId: z.string().uuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        // Fetch appointment with related data
        const [appointment] = await ctx.db
          .select({
            id: appointments.id,
            startTime: appointments.startTime,
            endTime: appointments.endTime,
            title: appointments.title,
            patientId: appointments.patientId,
            vetId: appointments.vetId,
          })
          .from(appointments)
          .where(
            and(
              eq(appointments.id, input.appointmentId),
              eq(appointments.tenantId, input.tenantId)
            )
          );

        if (!appointment) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Termin nicht gefunden',
          });
        }

        // Fetch patient
        const [patient] = await ctx.db
          .select({
            id: patients.id,
            name: patients.name,
            ownerId: patients.ownerId,
          })
          .from(patients)
          .where(eq(patients.id, appointment.patientId));

        if (!patient) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Patient nicht gefunden',
          });
        }

        // Fetch owner
        const [owner] = await ctx.db
          .select({
            id: owners.id,
            firstName: owners.firstName,
            lastName: owners.lastName,
            email: owners.email,
          })
          .from(owners)
          .where(eq(owners.id, patient.ownerId));

        if (!owner) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Besitzer nicht gefunden',
          });
        }

        // Fetch tenant info for clinic name
        const tenant = await ctx.db.query.tenants.findFirst({
          where: (t, { eq }) => eq(t.id, input.tenantId),
        });

        if (!tenant) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Praxis nicht gefunden',
          });
        }

        // Generate confirmation token
        const confirmToken = generateConfirmationToken(
          appointment.id,
          owner.email,
          'confirm'
        );

        // Build confirmation link
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
        const confirmLink = buildConfirmationUrl(confirmToken, baseUrl, 'confirm');

        // Format appointment date/time
        const startDate = new Date(appointment.startTime);
        const dateStr = startDate.toLocaleDateString('de-DE', {
          weekday: 'long',
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        });
        const timeStr = startDate.toLocaleTimeString('de-DE', {
          hour: '2-digit',
          minute: '2-digit',
        });

        // Send confirmation email
        const result = await sendTemplateEmail(
          confirmationTemplate,
          owner.email,
          {
            ownerName: owner.firstName,
            patientName: patient.name,
            clinicName: tenant.name,
            date: dateStr,
            time: timeStr,
            confirmLink,
          },
          `${tenant.name} <${process.env.RESEND_FROM_EMAIL || "noreply@resend.dev"}>`
        );

        if (!result.success) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `Email konnte nicht gesendet werden: ${result.error}`,
          });
        }

        return {
          success: true,
          messageId: result.messageId,
          message: 'Bestätigungsemail gesendet',
        };
      } catch (error) {
        console.error('Error sending confirmation email:', error);
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Fehler beim Versand der Bestätigungsemail',
        });
      }
    }),

  /**
   * Protected: Send cancellation email
   * Called when admin rejects a booking
   */
  sendCancellationEmail: protectedProcedure
    .input(
      z.object({
        appointmentId: z.string().uuid(),
        tenantId: z.string().uuid(),
        reason: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        // Fetch appointment with related data
        const [appointment] = await ctx.db
          .select({
            id: appointments.id,
            startTime: appointments.startTime,
            endTime: appointments.endTime,
            patientId: appointments.patientId,
          })
          .from(appointments)
          .where(
            and(
              eq(appointments.id, input.appointmentId),
              eq(appointments.tenantId, input.tenantId)
            )
          );

        if (!appointment) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Termin nicht gefunden',
          });
        }

        // Fetch patient and owner
        const [patient] = await ctx.db
          .select({
            id: patients.id,
            name: patients.name,
            ownerId: patients.ownerId,
          })
          .from(patients)
          .where(eq(patients.id, appointment.patientId));

        if (!patient) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Patient nicht gefunden',
          });
        }

        const [owner] = await ctx.db
          .select({
            id: owners.id,
            firstName: owners.firstName,
            lastName: owners.lastName,
            email: owners.email,
          })
          .from(owners)
          .where(eq(owners.id, patient.ownerId));

        if (!owner) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Besitzer nicht gefunden',
          });
        }

        const tenant = await ctx.db.query.tenants.findFirst({
          where: (t, { eq }) => eq(t.id, input.tenantId),
        });

        if (!tenant) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Praxis nicht gefunden',
          });
        }

        // Format appointment date/time
        const startDate = new Date(appointment.startTime);
        const dateStr = startDate.toLocaleDateString('de-DE', {
          weekday: 'long',
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        });
        const timeStr = startDate.toLocaleTimeString('de-DE', {
          hour: '2-digit',
          minute: '2-digit',
        });

        // Send cancellation email
        const result = await sendTemplateEmail(
          cancellationTemplate,
          owner.email,
          {
            ownerName: owner.firstName,
            patientName: patient.name,
            clinicName: tenant.name,
            date: dateStr,
            time: timeStr,
            reason: input.reason || '',
          },
          `${tenant.name} <${process.env.RESEND_FROM_EMAIL || "noreply@resend.dev"}>`
        );

        if (!result.success) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `Email konnte nicht gesendet werden: ${result.error}`,
          });
        }

        return {
          success: true,
          messageId: result.messageId,
          message: 'Absageemail gesendet',
        };
      } catch (error) {
        console.error('Error sending cancellation email:', error);
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Fehler beim Versand der Absageemail',
        });
      }
    }),
});
