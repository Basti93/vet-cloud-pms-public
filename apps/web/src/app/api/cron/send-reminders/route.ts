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

function stringifyError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (!error || typeof error !== "object") return String(error);

  const maybeError = error as {
    name?: string;
    message?: string;
    code?: string | number;
    statusCode?: number;
    type?: string;
  };

  const compact = {
    name: maybeError.name,
    message: maybeError.message,
    code: maybeError.code,
    statusCode: maybeError.statusCode,
    type: maybeError.type,
  };

  if (compact.name || compact.message || compact.code || compact.statusCode || compact.type) {
    return JSON.stringify(compact);
  }

  try {
    return JSON.stringify(error);
  } catch {
    return Object.prototype.toString.call(error);
  }
}

/**
 * Cron job to send reminder emails for upcoming appointments.
 * Runs daily via Coolify scheduled task, scanning a 24h window.
 *
 * Security: Requires CRON_SECRET header to match environment variable
 */
export async function POST(request: NextRequest) {
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
    const tenantDebugStats: Array<{
      tenantId: string;
      tenantSlug: string;
      tenantName: string;
      appointment: {
        settingsPresent: boolean;
        enabled: boolean;
        reminderHoursBefore: number;
        candidates: number;
        alreadySent: number;
        toSend: number;
        skippedMissingEmail: number;
        sent: number;
        failed: number;
      };
      vaccination: {
        settingsPresent: boolean;
        enabled: boolean;
        reminderDaysBefore: number;
        remindCore: boolean;
        remindRecommended: boolean;
        remindOptional: boolean;
        remindOverdue: boolean;
        dueRaw: number;
        afterCategoryFilter: number;
        dedupedRecentSent: number;
        toSend: number;
        ownersGrouped: number;
        skippedMissingEmail: number;
        digestSent: number;
        digestFailed: number;
      };
    }> = [];

    for (const tenant of allTenants) {
      const tenantStats = {
        tenantId: tenant.id,
        tenantSlug: tenant.slug,
        tenantName: tenant.name ?? SYSTEM_DOMAIN,
        appointment: {
          settingsPresent: false,
          enabled: false,
          reminderHoursBefore: 24,
          candidates: 0,
          alreadySent: 0,
          toSend: 0,
          skippedMissingEmail: 0,
          sent: 0,
          failed: 0,
        },
        vaccination: {
          settingsPresent: false,
          enabled: true,
          reminderDaysBefore: 30,
          remindCore: true,
          remindRecommended: true,
          remindOptional: false,
          remindOverdue: true,
          dueRaw: 0,
          afterCategoryFilter: 0,
          dedupedRecentSent: 0,
          toSend: 0,
          ownersGrouped: 0,
          skippedMissingEmail: 0,
          digestSent: 0,
          digestFailed: 0,
        },
      };

      // Get email settings for this tenant
      const settings = await db
        .select()
        .from(emailSettings)
        .where(eq(emailSettings.tenantId, tenant.id))
        .limit(1);

      const tenantEmailSettings = settings[0];
      tenantStats.appointment.settingsPresent = !!tenantEmailSettings;
      const reminderEmailEnabled =
        tenantEmailSettings?.reminderEmailEnabled ?? true;
      const reminderHoursBefore = tenantEmailSettings?.reminderHoursBefore ?? 24;
      tenantStats.appointment.enabled = reminderEmailEnabled;
      tenantStats.appointment.reminderHoursBefore = reminderHoursBefore;

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
        tenantStats.appointment.candidates = appointmentsToRemind.length;

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
          tenantStats.appointment.alreadySent = sentReminders.length;

          const sentIds = new Set(sentReminders.map((r) => r.appointmentId));
          const newReminders = appointmentsToRemind.filter((a) => !sentIds.has(a.id));
          tenantStats.appointment.toSend = newReminders.length;

          // Send reminders for appointments that don't have one yet
          for (const appointment of newReminders) {
            try {
              if (!appointment.ownerEmail) {
                tenantStats.appointment.skippedMissingEmail++;
                continue;
              }

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
                tenantStats.appointment.sent++;
              } else {
                // Log the failed email
                const errorMsg = stringifyError(result.error);
                await db.insert(appointmentEmailLogs).values({
                  tenantId: tenant.id,
                  appointmentId: appointment.id,
                  emailType: "reminder",
                  recipientEmail: appointment.ownerEmail,
                  status: "failed",
                  errorMessage: errorMsg,
                });
                totalFailed++;
                tenantStats.appointment.failed++;
              }
            } catch (error) {
              totalFailed++;
              tenantStats.appointment.failed++;
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

      tenantStats.vaccination.settingsPresent = !!vaxSettings[0];
      const reminderEnabled = vaxSettings[0]?.reminderEnabled ?? true;
      const reminderDaysBefore = vaxSettings[0]?.reminderDaysBefore ?? 30;
      const remindCore = vaxSettings[0]?.remindCore ?? true;
      const remindRecommended = vaxSettings[0]?.remindRecommended ?? true;
      const remindOptional = vaxSettings[0]?.remindOptional ?? false;
      const remindOverdue = vaxSettings[0]?.remindOverdue ?? true;
      tenantStats.vaccination.enabled = reminderEnabled;
      tenantStats.vaccination.reminderDaysBefore = reminderDaysBefore;
      tenantStats.vaccination.remindCore = remindCore;
      tenantStats.vaccination.remindRecommended = remindRecommended;
      tenantStats.vaccination.remindOptional = remindOptional;
      tenantStats.vaccination.remindOverdue = remindOverdue;

      if (!reminderEnabled) {
        tenantDebugStats.push(tenantStats);
        continue;
      }

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
      tenantStats.vaccination.dueRaw = dueVaccinations.length;

      // Category filter: apply in-process so free-text vaccinations (no FK) always pass through
      const categoryFilteredVaccinations = dueVaccinations.filter((v) => {
        const cat = v.typeCategory;
        if (!cat) return true; // free-text vaccination → always remind
        if (cat === "core") return remindCore;
        if (cat === "recommended") return remindRecommended;
        if (cat === "non-core") return remindOptional;
        return true; // unknown category → remind to be safe
      });
      tenantStats.vaccination.afterCategoryFilter = categoryFilteredVaccinations.length;

      if (categoryFilteredVaccinations.length === 0) {
        tenantDebugStats.push(tenantStats);
        continue;
      }

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
      tenantStats.vaccination.dedupedRecentSent = recentLogs.length;
      const recentlySentIds = new Set(recentLogs.map((r) => r.vaccinationId));
      const toSend = categoryFilteredVaccinations.filter((v) => !recentlySentIds.has(v.id));
      tenantStats.vaccination.toSend = toSend.length;

      // ── Digest: group by owner, send ONE email per owner ─────────────────
      const byOwner = new Map<
        string,
        { ownerEmail: string; ownerFirstName: string; ownerId: string; vacs: typeof toSend }
      >();
      for (const v of toSend) {
        if (!v.ownerEmail) {
          tenantStats.vaccination.skippedMissingEmail++;
          continue;
        }
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
      tenantStats.vaccination.ownersGrouped = byOwner.size;

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
          tenantStats.vaccination.digestSent++;
        } else {
          const errorMessage = stringifyError(result.error);
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
          tenantStats.vaccination.digestFailed++;
        }
      }

      tenantDebugStats.push(tenantStats);
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
          tenantsProcessed: allTenants.length,
          tenantDebugStats,
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
