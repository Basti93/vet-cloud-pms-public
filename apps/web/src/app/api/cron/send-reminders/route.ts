import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { appointments, emailSettings, appointmentEmailLogs, tenants, patients, owners } from "@/lib/db/schema";
import { and, gte, lte, inArray, eq } from "drizzle-orm";
import { sendReminderEmail } from "@/lib/email/service";
import { executeDueTenantDeletions } from "@/server/tenant-deletion";
import { getSystemDomain } from "@/lib/system-name";

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
      .select({ id: tenants.id })
      .from(tenants);

    let totalSent = 0;
    let totalFailed = 0;

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
      const tenantData = await db
        .select({ name: tenants.name })
        .from(tenants)
        .where(eq(tenants.id, tenant.id))
        .limit(1);

      const practiceName = tenantData[0]?.name || SYSTEM_DOMAIN;

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
    }

    return NextResponse.json(
      {
        success: true,
        message: `Cron job completed. Sent: ${totalSent}, Failed: ${totalFailed}`,
        stats: { totalSent, totalFailed, ...deletionCleanup },
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
