import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import {
  appointments,
  emailSettings,
  appointmentEmailLogs,
  tenants,
  patients,
  owners,
  vaccinations,
  vaccinationSettings,
  vaccinationEmailLogs,
} from "@/lib/db/schema";
import { and, gte, lte, inArray, eq, isNull } from "drizzle-orm";
import { sendReminderEmail, sendVaccinationReminderEmail } from "@/lib/email/service";
import { executeDueTenantDeletions } from "@/server/tenant-deletion";
import { getSystemDomain } from "@/lib/system-name";
import { getMainDomain } from "@/lib/env";

// Vercel cron jobs require a secret for security
const CRON_SECRET = process.env.CRON_SECRET;
const CRON_LOOKAHEAD_HOURS = 24;
const SYSTEM_DOMAIN = getSystemDomain();

/**
 * Cron job to send reminder emails for upcoming appointments.
 * On Vercel Hobby this runs once per day, so we scan a 24h window.
 *
 * Security: Requires CRON_SECRET header to match environment variable
 */
export async function GET(request: NextRequest) {
  // Verify the cron secret
  const authHeader = request.headers.get("authorization");
  if (!CRON_SECRET || authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const now = new Date();
    const deletionCleanup = await executeDueTenantDeletions();

    // Get all tenants (needed to fetch their email settings)
    const allTenants = await db
      .select({ id: tenants.id, slug: tenants.slug, name: tenants.name })
      .from(tenants);

    let totalSent = 0;
    let totalFailed = 0;
    let vaccinationRemindersSent = 0;
    let vaccinationRemindersFailed = 0;

    for (const tenant of allTenants) {
      // Get email settings for this tenant
      const settings = await db
        .select()
        .from(emailSettings)
        .where(eq(emailSettings.tenantId, tenant.id))
        .limit(1);

      if (!settings[0] || !settings[0].reminderEmailEnabled) {
        continue; // Skip if reminders are disabled
      }

      const reminderHoursBefore = settings[0].reminderHoursBefore;
      // Daily cron (Hobby-compatible): scan a 24h window around the configured threshold.
      const windowStart = new Date(
        now.getTime() + reminderHoursBefore * 60 * 60 * 1000
      );
      const windowEnd = new Date(
        windowStart.getTime() + CRON_LOOKAHEAD_HOURS * 60 * 60 * 1000
      );

      // Find appointments in the reminder window that haven't been sent reminders yet
      const appointmentsToRemind = await db
        .select({
          id: appointments.id,
          startTime: appointments.startTime,
          title: appointments.title,
          patientName: patients.name,
          patientSpecies: patients.species,
          ownerFirstName: owners.firstName,
          ownerLastName: owners.lastName,
          ownerEmail: owners.email,
        })
        .from(appointments)
        .innerJoin(patients, eq(appointments.patientId, patients.id))
        .innerJoin(owners, eq(patients.ownerId, owners.id))
        .where(
          and(
            eq(appointments.tenantId, tenant.id),
            eq(appointments.status, "scheduled"),
            gte(appointments.startTime, windowStart),
            lte(appointments.startTime, windowEnd)
          )
        );

      // Filter out appointments that already have sent reminders
      const appointmentIds = appointmentsToRemind.map((a) => a.id);
      if (appointmentIds.length === 0) continue;

      const sentReminders = await db
        .select({ appointmentId: appointmentEmailLogs.appointmentId })
        .from(appointmentEmailLogs)
        .where(
          and(
            inArray(appointmentEmailLogs.appointmentId, appointmentIds),
            eq(appointmentEmailLogs.emailType, "reminder"),
            eq(appointmentEmailLogs.status, "sent")
          )
        );

      const sentIds = new Set(sentReminders.map((r) => r.appointmentId));
      const newReminders = appointmentsToRemind.filter((a) => !sentIds.has(a.id));

      // Get tenant info for practice name
      const practiceName = tenant.name || SYSTEM_DOMAIN;
      const bookingUrl = `${getMainDomain()}/book/${tenant.slug}`;

      // Send reminders for appointments that don't have one yet
      for (const appointment of newReminders) {
        try {
          if (!appointment.ownerEmail) continue;

          // Send the reminder email
          const appointmentTime = appointment.startTime.toLocaleTimeString("de-DE", {
            hour: "2-digit",
            minute: "2-digit",
          });
          const appointmentDate = appointment.startTime.toLocaleDateString("de-DE");
          const appointmentDateTime = `${appointmentDate} ${appointmentTime}`;

          const result = await sendReminderEmail({
            to: appointment.ownerEmail,
            practiceName,
            ownerFirstName: appointment.ownerFirstName,
            patientName: appointment.patientName,
            patientSpecies: appointment.patientSpecies,
            appointmentTime,
            appointmentDateTime,
          });

          if (result.success) {
            // Log the sent email
            await db.insert(appointmentEmailLogs).values({
              tenantId: tenant.id,
              appointmentId: appointment.id,
              emailType: "reminder",
              recipientEmail: appointment.ownerEmail,
              status: "sent",
            });
            totalSent++;
          } else {
            // Log the failed email
            const errorMsg = result.error instanceof Error
              ? result.error.message
              : String(result.error);
            await db.insert(appointmentEmailLogs).values({
              tenantId: tenant.id,
              appointmentId: appointment.id,
              emailType: "reminder",
              recipientEmail: appointment.ownerEmail,
              status: "failed",
              errorMessage: errorMsg,
            });
            totalFailed++;
          }
        } catch (error) {
          totalFailed++;
          console.error(
            `Failed to send reminder for appointment ${appointment.id}:`,
            error
          );
        }
      }

      const vaxSettings = await db
        .select()
        .from(vaccinationSettings)
        .where(eq(vaccinationSettings.tenantId, tenant.id))
        .limit(1);

      const reminderEnabled = vaxSettings[0]?.reminderEnabled ?? true;
      const reminderDaysBefore = vaxSettings[0]?.reminderDaysBefore ?? 30;
      const reminderSubject = vaxSettings[0]?.reminderSubject ?? "Impf-Erinnerung für {petName}";
      const reminderBody =
        vaxSettings[0]?.reminderBody ??
        "Hallo {ownerName},\n\nfür {petName} ist die Auffrischung ({vaccinationType}) am {dueDate} fällig.\nBitte vereinbaren Sie einen Termin bei {clinicName}.\n\nViele Grüße\n{clinicName}";

      if (!reminderEnabled) {
        continue;
      }

      const remindUntil = new Date(now.getTime() + reminderDaysBefore * 24 * 60 * 60 * 1000);
      const dueVaccinations = await db
        .select({
          id: vaccinations.id,
          expiryDate: vaccinations.expiryDate,
          type: vaccinations.type,
          patientName: patients.name,
          ownerEmail: owners.email,
          ownerFirstName: owners.firstName,
        })
        .from(vaccinations)
        .innerJoin(patients, eq(vaccinations.patientId, patients.id))
        .innerJoin(owners, eq(patients.ownerId, owners.id))
        .where(
          and(
            eq(vaccinations.tenantId, tenant.id),
            isNull(vaccinations.deletedAt),
            isNull(vaccinations.reminderSentDate),
            lte(vaccinations.expiryDate, remindUntil)
          )
        );

      for (const item of dueVaccinations) {
        if (!item.ownerEmail) continue;
        const result = await sendVaccinationReminderEmail({
          tenantId: tenant.id,
          vaccinationId: item.id,
          ownerEmail: item.ownerEmail,
          ownerName: item.ownerFirstName,
          petName: item.patientName,
          vaccinationType: item.type,
          dueDate: item.expiryDate,
          clinicName: practiceName,
          bookingUrl,
          customSubject: reminderSubject,
          customBody: reminderBody,
        });

        if (result.success) {
          await db.insert(vaccinationEmailLogs).values({
            tenantId: tenant.id,
            vaccinationId: item.id,
            emailAddress: item.ownerEmail,
            status: "sent",
            messageId: result.messageId,
          });
          await db
            .update(vaccinations)
            .set({ reminderSentDate: new Date(), updatedAt: new Date() })
            .where(eq(vaccinations.id, item.id));
          vaccinationRemindersSent++;
        } else {
          const errorMessage =
            result.error instanceof Error ? result.error.message : String(result.error);
          await db.insert(vaccinationEmailLogs).values({
            tenantId: tenant.id,
            vaccinationId: item.id,
            emailAddress: item.ownerEmail,
            status: "failed",
            error: errorMessage,
          });
          vaccinationRemindersFailed++;
        }
      }
    }

    return NextResponse.json(
      {
        success: true,
        message: `Cron job completed. Sent: ${totalSent}, Failed: ${totalFailed}`,
        stats: {
          totalSent,
          totalFailed,
          vaccinationRemindersSent,
          vaccinationRemindersFailed,
          ...deletionCleanup,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Cron job error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to process reminder emails",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

// Configure this route for Vercel cron jobs
export const maxDuration = 60; // 60 seconds timeout for serverless
