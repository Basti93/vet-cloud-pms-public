import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { appointments, emailSettings, appointmentEmailLogs, tenants, patients, owners } from "@/lib/db/schema";
import { and, gte, lte, inArray, eq } from "drizzle-orm";
import { sendReminderEmail } from "@/lib/email/service";

// Vercel cron jobs require a secret for security
const CRON_SECRET = process.env.CRON_SECRET;

/**
 * Cron job to send 24-hour reminder emails for upcoming appointments.
 * Runs every hour and sends reminders for appointments within the configured reminder window.
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
    const maxTime = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours from now

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
      const minTime = new Date(now.getTime() - reminderHoursBefore * 60 * 60 * 1000);

      // Find appointments in the reminder window that haven't been sent reminders yet
      const appointmentsToRemind = await db
        .select({
          id: appointments.id,
          startTime: appointments.startTime,
          patientId: appointments.patientId,
          title: appointments.title,
        })
        .from(appointments)
        .where(
          and(
            eq(appointments.tenantId, tenant.id),
            eq(appointments.status, "scheduled"),
            gte(appointments.startTime, minTime),
            lte(appointments.startTime, maxTime)
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
            eq(appointmentEmailLogs.emailType, "reminder")
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

      const practiceName = tenantData[0]?.name || "VetCloud PMS";

      // Send reminders for appointments that don't have one yet
      for (const appointment of newReminders) {
        try {
          // Fetch patient and owner info
          const patientData = await db
            .select({ ownerId: patients.ownerId, name: patients.name, species: patients.species })
            .from(patients)
            .where(eq(patients.id, appointment.patientId))
            .limit(1);

          if (!patientData[0]) continue;

          const ownerData = await db
            .select({ firstName: owners.firstName, lastName: owners.lastName, email: owners.email })
            .from(owners)
            .where(eq(owners.id, patientData[0].ownerId))
            .limit(1);

          if (!ownerData[0] || !ownerData[0].email) continue;

          // Send the reminder email
          const appointmentTime = appointment.startTime.toLocaleTimeString("de-DE", {
            hour: "2-digit",
            minute: "2-digit",
          });
          const appointmentDate = appointment.startTime.toLocaleDateString("de-DE");
          const appointmentDateTime = `${appointmentDate} ${appointmentTime}`;

          const result = await sendReminderEmail({
            to: ownerData[0].email,
            practiceName,
            ownerFirstName: ownerData[0].firstName,
            patientName: patientData[0].name,
            patientSpecies: patientData[0].species,
            appointmentTime,
            appointmentDateTime,
          });

          if (result.success) {
            // Log the sent email
            await db.insert(appointmentEmailLogs).values({
              tenantId: tenant.id,
              appointmentId: appointment.id,
              emailType: "reminder",
              recipientEmail: ownerData[0].email,
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
              recipientEmail: ownerData[0].email,
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
        stats: { totalSent, totalFailed },
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
