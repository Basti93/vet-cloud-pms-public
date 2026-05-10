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
  vaccinationTypes,
  vaccinationSettings,
  vaccinationEmailLogs,
} from "@/lib/db/schema";
import { and, gte, lte, inArray, eq, isNull, ne } from "drizzle-orm";
import { sendReminderEmail, sendVaccinationDigestEmail } from "@/lib/email/service";
import { executeDueTenantDeletions } from "@/server/tenant-deletion";
import { getSystemDomain } from "@/lib/system-name";
import { getMainDomain } from "@/lib/env";
import { buildUnsubscribeUrl } from "@/lib/unsubscribe";

const CRON_SECRET = process.env.CRON_SECRET;
const CRON_LOOKAHEAD_HOURS = 24;
const SYSTEM_DOMAIN = getSystemDomain();

/**
 * Cron job to send reminder emails for upcoming appointments.
 * Runs daily via Coolify scheduled task, scanning a 24h window.
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
      .select({ id: tenants.id, slug: tenants.slug, name: tenants.name, timezone: tenants.timezone })
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

      const tenantEmailSettings = settings[0];
      const reminderEmailEnabled =
        tenantEmailSettings?.reminderEmailEnabled ?? true;
      const reminderHoursBefore = tenantEmailSettings?.reminderHoursBefore ?? 24;

      // Get tenant info for practice name
      const practiceName = tenant.name || SYSTEM_DOMAIN;
      const bookingUrl = `${getMainDomain()}/book/${tenant.slug}`;

      if (reminderEmailEnabled) {
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
              inArray(appointments.status, ["scheduled", "confirmed"]),
              gte(appointments.startTime, windowStart),
              lte(appointments.startTime, windowEnd)
            )
          );

        // Filter out appointments that already have sent reminders
        const appointmentIds = appointmentsToRemind.map((a) => a.id);
        if (appointmentIds.length > 0) {
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
                appointmentDate,
                appointmentTime,
                appointmentDateTime,
                customSubject: tenantEmailSettings?.reminderSubject,
                customBody: tenantEmailSettings?.reminderBody,
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
      }

      const vaxSettings = await db
        .select()
        .from(vaccinationSettings)
        .where(eq(vaccinationSettings.tenantId, tenant.id))
        .limit(1);

      const reminderEnabled = vaxSettings[0]?.reminderEnabled ?? true;
      const reminderDaysBefore = vaxSettings[0]?.reminderDaysBefore ?? 30;
      const remindCore = vaxSettings[0]?.remindCore ?? true;
      const remindRecommended = vaxSettings[0]?.remindRecommended ?? true;
      const remindOptional = vaxSettings[0]?.remindOptional ?? false;
      const remindOverdue = vaxSettings[0]?.remindOverdue ?? true;

      if (!reminderEnabled) continue;

      // Use tenant timezone for the due-date window so reminder fires at the
      // right local date rather than always in UTC.
      const tenantTz = tenant.timezone ?? "Europe/Berlin";
      const remindUntilMs = now.getTime() + reminderDaysBefore * 24 * 60 * 60 * 1000;
      // Shift window by UTC offset of tenant timezone to align with local midnight.
      const tzOffset = new Intl.DateTimeFormat("en", {
        timeZone: tenantTz,
        timeZoneName: "shortOffset",
      })
        .formatToParts(now)
        .find((p) => p.type === "timeZoneName")
        ?.value?.replace("GMT", "") ?? "+0";
      const [tzHours, tzMins] = tzOffset.split(":").map(Number);
      const tzOffsetMs = ((tzHours ?? 0) * 60 + (tzMins ?? 0)) * 60 * 1000;
      const remindUntil = new Date(remindUntilMs - tzOffsetMs);

      const dueVaccinations = await db
        .select({
          id: vaccinations.id,
          expiryDate: vaccinations.expiryDate,
          type: vaccinations.type,
          patientName: patients.name,
          ownerId: owners.id,
          ownerEmail: owners.email,
          ownerFirstName: owners.firstName,
          ownerEmailOptOut: owners.emailOptOut,
          // Resolved type name + category from catalogue
          typeName: vaccinationTypes.name,
          typeCategory: vaccinationTypes.category,
        })
        .from(vaccinations)
        .innerJoin(patients, eq(vaccinations.patientId, patients.id))
        .innerJoin(owners, eq(patients.ownerId, owners.id))
        .leftJoin(vaccinationTypes, eq(vaccinations.vaccinationTypeId, vaccinationTypes.id))
        .where(
          and(
            eq(vaccinations.tenantId, tenant.id),
            isNull(vaccinations.deletedAt),
            isNull(vaccinations.reminderSentDate),
            // Overdue filter: skip already-expired if remindOverdue is off
            remindOverdue
              ? lte(vaccinations.expiryDate, remindUntil)
              : and(gte(vaccinations.expiryDate, now), lte(vaccinations.expiryDate, remindUntil)),
            // Skip owners who have opted out of email reminders (GDPR Art. 21)
            ne(owners.emailOptOut, true)
          )
        );

      // Category filter: apply in-process so free-text vaccinations (no FK) always pass through
      const categoryFilteredVaccinations = dueVaccinations.filter((v) => {
        const cat = v.typeCategory;
        if (!cat) return true; // free-text vaccination → always remind
        if (cat === "core") return remindCore;
        if (cat === "recommended") return remindRecommended;
        if (cat === "non-core") return remindOptional;
        return true; // unknown category → remind to be safe
      });

      if (categoryFilteredVaccinations.length === 0) continue;

      // Deduplication: skip vaccinations already sent within last 25h
      const recentLogs = await db
        .select({ vaccinationId: vaccinationEmailLogs.vaccinationId })
        .from(vaccinationEmailLogs)
        .where(
          and(
            inArray(
              vaccinationEmailLogs.vaccinationId,
              categoryFilteredVaccinations.map((v) => v.id)
            ),
            eq(vaccinationEmailLogs.status, "sent"),
            gte(
              vaccinationEmailLogs.sentAt,
              new Date(now.getTime() - 25 * 60 * 60 * 1000)
            )
          )
        );
      const recentlySentIds = new Set(recentLogs.map((r) => r.vaccinationId));
      const toSend = categoryFilteredVaccinations.filter((v) => !recentlySentIds.has(v.id));

      // ── Digest: group by owner, send ONE email per owner ─────────────────
      const byOwner = new Map<
        string,
        { ownerEmail: string; ownerFirstName: string; ownerId: string; vacs: typeof toSend }
      >();
      for (const v of toSend) {
        if (!v.ownerEmail) continue;
        if (!byOwner.has(v.ownerId)) {
          byOwner.set(v.ownerId, {
            ownerEmail: v.ownerEmail,
            ownerFirstName: v.ownerFirstName,
            ownerId: v.ownerId,
            vacs: [],
          });
        }
        byOwner.get(v.ownerId)!.vacs.push(v);
      }

      for (const owner of byOwner.values()) {
        const items = owner.vacs.map((v) => ({
          petName: v.patientName,
          vaccinationType: v.typeName ?? v.type ?? "Impfung",
          dueDate: v.expiryDate.toLocaleDateString("de-DE"),
        }));

        const unsubscribeUrl = buildUnsubscribeUrl(owner.ownerId);
        const result = await sendVaccinationDigestEmail({
          ownerEmail: owner.ownerEmail,
          ownerName: owner.ownerFirstName,
          items,
          clinicName: practiceName,
          bookingUrl,
          unsubscribeUrl,
        });

        if (result.success) {
          // Log + mark all vaccinations in this digest as sent
          for (const v of owner.vacs) {
            await db.insert(vaccinationEmailLogs).values({
              tenantId: tenant.id,
              vaccinationId: v.id,
              emailAddress: owner.ownerEmail,
              status: "sent",
              messageId: result.messageId,
            });
            await db
              .update(vaccinations)
              .set({ reminderSentDate: new Date(), updatedAt: new Date() })
              .where(eq(vaccinations.id, v.id));
          }
          vaccinationRemindersSent++;
        } else {
          const errorMessage =
            result.error instanceof Error
              ? result.error.message
              : String(result.error);
          for (const v of owner.vacs) {
            await db.insert(vaccinationEmailLogs).values({
              tenantId: tenant.id,
              vaccinationId: v.id,
              emailAddress: owner.ownerEmail,
              status: "failed",
              error: errorMessage,
            });
          }
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

export const maxDuration = 60;
