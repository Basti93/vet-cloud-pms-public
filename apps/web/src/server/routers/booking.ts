import { z } from "zod";
import { eq, and, gte, gt, lt, sql, ne } from "drizzle-orm";
import { createTRPCRouter, publicProcedure, publicBookingProcedure, tenantProcedure } from "@/server/trpc";
import { tenants, appointments, owners, patients, users, userRoles, roles, appointmentHolds, emailSettings } from "@/lib/db/schema";
import { TRPCError } from "@trpc/server";
import { sendConfirmationEmail, sendBookingNotificationEmail, sendBookingRequestEmail } from "@/lib/email/service";
import type { SendConfirmationEmailInput, SendBookingNotificationInput, SendBookingRequestEmailInput } from "@/lib/email/service";
import { generateConfirmationToken, buildConfirmationUrl } from "@/lib/tokens/confirmation";
import { getMainDomain } from "@/lib/env";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type * as schema from "@/lib/db/schema";
import { ROLE_CODES } from "@/lib/auth/roles";
import {
  isEmbeddingOriginAllowed,
  isRequestAllowedByEmbeddingDomains,
  normalizeEmbeddingDomains,
} from "@/lib/booking/embed-origin";
import { createScheduleService } from "@/server/schedule-service";

// ── Slot generation ───────────────────────────────────────────────────────────

type Db = PostgresJsDatabase<typeof schema>;

async function getAllowedEmbeddingDomainsForTenant(
  db: Db,
  tenantId: string
): Promise<string[]> {
  const [tenant] = await db
    .select({ allowedEmbeddingDomains: tenants.allowedEmbeddingDomains })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);

  return normalizeEmbeddingDomains(
    (tenant?.allowedEmbeddingDomains as string[] | null) || []
  );
}

async function getAllowedEmbeddingDomainsForSlug(
  db: Db,
  slug: string
): Promise<string[]> {
  const [tenant] = await db
    .select({ allowedEmbeddingDomains: tenants.allowedEmbeddingDomains })
    .from(tenants)
    .where(eq(tenants.slug, slug))
    .limit(1);

  return normalizeEmbeddingDomains(
    (tenant?.allowedEmbeddingDomains as string[] | null) || []
  );
}

async function assertEmbeddingOriginAllowed(
  db: Db,
  headers: Headers,
  opts: { tenantId?: string; slug?: string; embeddingOrigin?: string }
) {
  const configuredDomains = opts.tenantId
    ? await getAllowedEmbeddingDomainsForTenant(db, opts.tenantId)
    : opts.slug
      ? await getAllowedEmbeddingDomainsForSlug(db, opts.slug)
      : [];

  // Always allow the booking app's own domain (self-hosted page access).
  let mainDomainHost: string | null = null;
  try {
    mainDomainHost = new URL(getMainDomain()).hostname;
  } catch {
    mainDomainHost = null;
  }

  const allowedDomains = normalizeEmbeddingDomains(
    mainDomainHost ? [...configuredDomains, mainDomainHost] : configuredDomains
  );

  // No allowlist configured => keep current open behavior
  if (allowedDomains.length === 0) return;

  if (opts.embeddingOrigin !== undefined) {
    if (isEmbeddingOriginAllowed(opts.embeddingOrigin, allowedDomains)) {
      return;
    }

    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Diese Domain ist nicht autorisiert, das Buchungs-Widget einzubinden",
    });
  }

  if (!isRequestAllowedByEmbeddingDomains(headers, allowedDomains)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Diese Domain ist nicht autorisiert, das Buchungs-Widget einzubinden",
    });
  }
}

// ── Router ────────────────────────────────────────────────────────────────────

export const bookingRouter = createTRPCRouter({
  /** Protected: List all online booking requests (for admin dashboard) */
  list: tenantProcedure
    .input(z.object({ tenantId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const bookings = await ctx.db
        .select({
          id: appointments.id,
          startTime: appointments.startTime,
          endTime: appointments.endTime,
          title: appointments.title,
          status: appointments.status,
          createdAt: appointments.createdAt,
          vetId: appointments.vetId,
          patient: {
            id: patients.id,
            name: patients.name,
            species: patients.species,
            breed: patients.breed,
          },
          owner: {
            id: owners.id,
            firstName: owners.firstName,
            lastName: owners.lastName,
            email: owners.email,
            phone: owners.phone,
          },
        })
        .from(appointments)
        .innerJoin(patients, eq(appointments.patientId, patients.id))
        .innerJoin(owners, eq(patients.ownerId, owners.id))
        .where(
          and(
            eq(appointments.tenantId, input.tenantId),
            eq(appointments.source, "online_booking")
          )
        );

      return bookings;
    }),

  /** Protected: Confirm a booking request (status = "confirmed" = confirmed by admin) */
  confirm: tenantProcedure
    .input(z.object({
      appointmentId: z.string().uuid(),
      tenantId: z.string().uuid(),
    }))
    .mutation(async ({ ctx, input }) => {
      const [existingAppt] = await ctx.db
        .select({
          id: appointments.id,
          status: appointments.status,
          patientId: appointments.patientId,
        })
        .from(appointments)
        .where(
          and(
            eq(appointments.id, input.appointmentId),
            eq(appointments.tenantId, input.tenantId),
            eq(appointments.source, "online_booking")
          )
        )
        .limit(1);

      if (!existingAppt) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Termin nicht gefunden" });
      }

      // Staff confirms a pending-confirmation appointment: run owner dedup/merge
      // (bypasses email verification step — equivalent to what confirmFromEmail does)
      if (existingAppt.status === "pending-confirmation") {
        const [provisionalPatient] = await ctx.db
          .select({ id: patients.id, ownerId: patients.ownerId, name: patients.name, species: patients.species, breed: patients.breed })
          .from(patients)
          .where(eq(patients.id, existingAppt.patientId))
          .limit(1);

        if (provisionalPatient) {
          const [provisionalOwner] = await ctx.db
            .select({ id: owners.id, email: owners.email })
            .from(owners)
            .where(eq(owners.id, provisionalPatient.ownerId))
            .limit(1);

          if (provisionalOwner?.email) {
            const [existingOwner] = await ctx.db
              .select({ id: owners.id })
              .from(owners)
              .where(
                and(
                  eq(owners.tenantId, input.tenantId),
                  sql`lower(${owners.email}) = lower(${provisionalOwner.email})`,
                  ne(owners.id, provisionalPatient.ownerId)
                )
              )
              .limit(1);

            if (existingOwner) {
              const [existingPatient] = await ctx.db
                .select({ id: patients.id })
                .from(patients)
                .where(
                  and(
                    eq(patients.ownerId, existingOwner.id),
                    sql`lower(${patients.name}) = lower(${provisionalPatient.name})`
                  )
                )
                .limit(1);

              let targetPatientId: string;
              if (existingPatient) {
                targetPatientId = existingPatient.id;
              } else {
                const [newPatient] = await ctx.db
                  .insert(patients)
                  .values({
                    tenantId: input.tenantId,
                    ownerId: existingOwner.id,
                    name: provisionalPatient.name,
                    species: provisionalPatient.species,
                    breed: provisionalPatient.breed ?? undefined,
                  })
                  .returning();
                targetPatientId = newPatient.id;
              }

              await ctx.db
                .update(appointments)
                .set({ patientId: targetPatientId })
                .where(eq(appointments.id, input.appointmentId));

              await ctx.db.delete(patients).where(eq(patients.id, provisionalPatient.id));
              await ctx.db.delete(owners).where(eq(owners.id, provisionalPatient.ownerId));
            }
          }
        }
      }

      const [appointment] = await ctx.db
        .update(appointments)
        .set({
          status: "confirmed",
          updatedAt: new Date(),
        })
        .where(eq(appointments.id, input.appointmentId))
        .returning();

      if (!appointment) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Termin nicht gefunden" });
      }

      // Send confirmation email to patient owner
      try {
        // Fetch patient, owner, and practice details
        const [patientData] = await ctx.db
          .select({
            patientName: patients.name,
            patientSpecies: patients.species,
            ownerFirstName: owners.firstName,
            ownerEmail: owners.email,
          })
          .from(patients)
          .innerJoin(owners, eq(patients.ownerId, owners.id))
          .where(eq(patients.id, appointment.patientId))
          .limit(1);

        const [tenant] = await ctx.db
          .select({ name: tenants.name })
          .from(tenants)
          .where(eq(tenants.id, input.tenantId))
          .limit(1);

        // Fetch vet name if assigned
        const [vet] = await ctx.db
          .select({ firstName: users.firstName, lastName: users.lastName })
          .from(users)
          .where(eq(users.id, appointment.vetId))
          .limit(1);

        if (patientData && patientData.ownerEmail && tenant) {
          // Check if confirmation emails are enabled
          const [settings] = await ctx.db
            .select()
            .from(emailSettings)
            .where(eq(emailSettings.tenantId, input.tenantId))
            .limit(1);

          if (settings?.confirmationEmailEnabled !== false) {
            const startDate = new Date(appointment.startTime);
            const dateStr = startDate.toLocaleDateString("de-DE", {
              weekday: "long",
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
            });
            const timeStr = startDate.toLocaleTimeString("de-DE", {
              hour: "2-digit",
              minute: "2-digit",
            });
            const dateTimeStr = `${dateStr} um ${timeStr}`;

            const emailInput: SendConfirmationEmailInput = {
              to: patientData.ownerEmail,
              practiceName: tenant.name,
              ownerFirstName: patientData.ownerFirstName,
              patientName: patientData.patientName,
              patientSpecies: patientData.patientSpecies,
              appointmentDate: dateStr,
              appointmentTime: timeStr,
              appointmentDateTime: dateTimeStr,
              vetName: vet ? `${vet.firstName} ${vet.lastName}` : undefined,
            };

            await sendConfirmationEmail(emailInput);
          }
        }
      } catch (emailError) {
        // Log error but don't fail the booking confirmation
        console.error("Failed to send confirmation email:", emailError);
      }

      return { success: true, appointmentId: appointment.id };
    }),

  /** Protected: Reject a booking request (status = "cancelled") */
  reject: tenantProcedure
    .input(z.object({
      appointmentId: z.string().uuid(),
      tenantId: z.string().uuid(),
      reason: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const [appointment] = await ctx.db
        .update(appointments)
        .set({
          status: "cancelled",
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(appointments.id, input.appointmentId),
            eq(appointments.tenantId, input.tenantId),
            eq(appointments.source, "online_booking")
          )
        )
        .returning();

      if (!appointment) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Termin nicht gefunden" });
      }

      return { success: true, appointmentId: appointment.id };
    }),

  /** Public: Fetch clinic info by slug for the booking widget header */
  getClinic: publicProcedure
    .input(
      z.object({
        slug: z.string().min(1),
        embeddingOrigin: z.string().optional(),
        previewToken: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const [tenant] = await ctx.db
        .select({
          id: tenants.id,
          name: tenants.name,
          slug: tenants.slug,
          email: tenants.email,
          phone: tenants.phone,
          address: tenants.address,
          city: tenants.city,
          postalCode: tenants.postalCode,
          tagline: tenants.tagline,
          themePreference: tenants.themePreference,
          typographyPreference: tenants.typographyPreference,
          monogram: tenants.monogram,
          allowedEmbeddingDomains: tenants.allowedEmbeddingDomains,
          websiteEnabled: tenants.websiteEnabled,
          previewToken: tenants.previewToken,
        })
        .from(tenants)
        .where(eq(tenants.slug, input.slug))
        .limit(1);

      if (!tenant) return null;

      if (!tenant.websiteEnabled) {
        const isPreviewValid = input.previewToken && tenant.previewToken &&
          input.previewToken === tenant.previewToken;

        const isAuthenticatedMember = ctx.userId
          ? await (async () => {
              const [member] = await ctx.db
                .select({ id: users.id })
                .from(users)
                .where(and(eq(users.clerkId, ctx.userId!), eq(users.tenantId, tenant.id)))
                .limit(1);
              return Boolean(member);
            })()
          : false;

        if (!isPreviewValid && !isAuthenticatedMember) return null;
      }

      await assertEmbeddingOriginAllowed(ctx.db, ctx.headers, {
        slug: input.slug,
        embeddingOrigin: input.embeddingOrigin,
      });

      // Strip internal fields before returning
      const { previewToken: _pt, websiteEnabled: _we, ...publicTenant } = tenant;
      return publicTenant;
    }),

  /** Public: List vets for booking widget */
  listPublicVets: publicProcedure
    .input(
      z.object({
        tenantId: z.string().uuid(),
        embeddingOrigin: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      await assertEmbeddingOriginAllowed(ctx.db, ctx.headers, {
        tenantId: input.tenantId,
        embeddingOrigin: input.embeddingOrigin,
      });

      const vets = await ctx.db
        .select({
          id: users.id,
          title: users.title,
          firstName: users.firstName,
          lastName: users.lastName,
          email: users.email,
        })
        .from(users)
        .innerJoin(userRoles, eq(userRoles.userId, users.id))
        .innerJoin(roles, eq(roles.id, userRoles.roleId))
        .where(
          and(
            eq(users.tenantId, input.tenantId),
            eq(roles.code, ROLE_CODES.VET),
            eq(users.active, true)
          )
        );

      return vets;
    }),

  /** Public: Suggest the best vet based on fair distribution */
  suggestPublicVet: publicBookingProcedure
    .input(
      z.object({
        tenantId: z.string().uuid(),
        startTime: z.date().optional(),
        endTime: z.date().optional(),
        embeddingOrigin: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await assertEmbeddingOriginAllowed(ctx.db, ctx.headers, {
        tenantId: input.tenantId,
        embeddingOrigin: input.embeddingOrigin,
      });

      const scheduleService = createScheduleService(ctx.db);
      try {
        return await scheduleService.selectVet({
          tenantId: input.tenantId,
          startTime: input.startTime,
          endTime: input.endTime,
        });
      } catch (error) {
        if (!(error instanceof Error) || error.message !== "No vets available for assignment") {
          throw error;
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Kein Tierarzt konfiguriert",
        });
      }
    }),

  /** Public: Return available 30-min slots for a given tenant + calendar date (optionally filtered by vet) */
  getAvailableSlots: publicProcedure
    .input(
      z.object({
        tenantId: z.string().uuid(),
        date: z.date(),
        vetId: z.string().uuid().optional(),
        embeddingOrigin: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      await assertEmbeddingOriginAllowed(ctx.db, ctx.headers, {
        tenantId: input.tenantId,
        embeddingOrigin: input.embeddingOrigin,
      });

      const scheduleService = createScheduleService(ctx.db);
      const slots = await scheduleService.getAvailableSlots({
        tenantId: input.tenantId,
        vetId: input.vetId,
        date: input.date,
      });

      return slots.map((s) => ({ start: s.start, end: s.end }));
    }),

  /** Public: Create owner + patient + appointment from booking widget */
  book: publicBookingProcedure
    .input(
      z.object({
        tenantId: z.string().uuid(),
        slotStart: z.date(),
        slotEnd: z.date(),
        reason: z.string().min(1).max(255),
        patient: z.object({
          name: z.string().min(1).max(100),
          species: z.string().min(1).max(50),
          breed: z.string().max(100).optional(),
        }),
        owner: z.object({
          firstName: z.string().min(1).max(100),
          lastName: z.string().min(1).max(100),
          email: z.string().email(),
          phone: z.string().min(3).max(20),
        }),
        vetId: z.string().uuid().optional(),
        browserSessionId: z.string().uuid(),
        embeddingOrigin: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await assertEmbeddingOriginAllowed(ctx.db, ctx.headers, {
        tenantId: input.tenantId,
        embeddingOrigin: input.embeddingOrigin,
      });

      // Verify tenant exists + slot is still in the future
      if (input.slotStart <= new Date()) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Dieser Zeitslot liegt in der Vergangenheit" });
      }

      // Use provided vetId or pick first active user (vet/admin) for this tenant as appointment owner
      let vet: { id: string } | undefined;
      if (input.vetId) {
        const [selectedVet] = await ctx.db
          .select({ id: users.id })
          .from(users)
          .where(and(eq(users.id, input.vetId), eq(users.tenantId, input.tenantId), eq(users.active, true)))
          .limit(1);
        vet = selectedVet;
      } else {
        const [firstVet] = await ctx.db
          .select({ id: users.id })
          .from(users)
          .where(and(eq(users.tenantId, input.tenantId), eq(users.active, true)))
          .limit(1);
        vet = firstVet;
      }

      if (!vet) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Kein Tierarzt konfiguriert" });
      }

      // Check slot is still available (race-condition guard)
      // A conflict exists if any existing appointment overlaps: apptStart < slotEnd AND apptEnd > slotStart
      const conflict = await ctx.db
        .select({ id: appointments.id })
        .from(appointments)
        .where(
          and(
            eq(appointments.tenantId, input.tenantId),
            lt(appointments.startTime, input.slotEnd),
            gt(appointments.endTime, input.slotStart)
          )
        )
        .limit(1);

      if (conflict.length > 0) {
        throw new TRPCError({ code: "CONFLICT", message: "Dieser Termin ist leider nicht mehr frei" });
      }

      // Rate limit: max 3 pending email confirmations per email per 24h (anti-abuse)
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const [pendingCheck] = await ctx.db
        .select({ cnt: sql<string>`count(*)` })
        .from(appointments)
        .innerJoin(patients, eq(patients.id, appointments.patientId))
        .innerJoin(owners, eq(owners.id, patients.ownerId))
        .where(
          and(
            eq(appointments.tenantId, input.tenantId),
            eq(appointments.status, "pending-confirmation"),
            sql`lower(${owners.email}) = lower(${input.owner.email})`,
            gte(appointments.createdAt, twentyFourHoursAgo)
          )
        );

      if (Number(pendingCheck?.cnt ?? 0) >= 3) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: "Zu viele ausstehende Buchungen. Bitte versuchen Sie es in 24 Stunden erneut.",
        });
      }

      // Create owner + patient for unverified booking
      const [owner] = await ctx.db
        .insert(owners)
        .values({
          tenantId: input.tenantId,
          firstName: input.owner.firstName,
          lastName: input.owner.lastName,
          email: input.owner.email,
          phone: input.owner.phone,
        })
        .returning();

      const [patient] = await ctx.db
        .insert(patients)
        .values({
          tenantId: input.tenantId,
          ownerId: owner.id,
          name: input.patient.name,
          species: input.patient.species,
          breed: input.patient.breed ?? undefined,
        })
        .returning();

      // Create appointment
      const [appointment] = await ctx.db
        .insert(appointments)
        .values({
          tenantId: input.tenantId,
          patientId: patient.id,
          vetId: vet.id,
          startTime: input.slotStart,
          endTime: input.slotEnd,
          title: input.reason,
          source: "online_booking",
          status: "pending-confirmation",
        })
        .returning();

      // Clean up all holds for this browser session (booking succeeded — DSGVO: delete session data)
      await ctx.db
        .delete(appointmentHolds)
        .where(
          and(
            eq(appointmentHolds.tenantId, input.tenantId),
            eq(appointmentHolds.browserSessionId, input.browserSessionId)
          )
        );

      // Send booking notification email to practice owner (fire and forget, don't block response)
      try {
        const [tenantData] = await ctx.db
          .select({
            tenantName: tenants.name,
            tenantEmail: tenants.email,
          })
          .from(tenants)
          .where(eq(tenants.id, input.tenantId))
          .limit(1);

        if (tenantData && tenantData.tenantEmail) {
          // Check if booking notifications are enabled
          const [settings] = await ctx.db
            .select()
            .from(emailSettings)
            .where(eq(emailSettings.tenantId, input.tenantId))
            .limit(1);

          if (settings?.bookingNotificationEnabled !== false) {
            const startDate = new Date(appointment.startTime);
            const dateStr = startDate.toLocaleDateString("de-DE", {
              weekday: "long",
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
            });
            const timeStr = startDate.toLocaleTimeString("de-DE", {
              hour: "2-digit",
              minute: "2-digit",
            });
            const dateTimeStr = `${dateStr} um ${timeStr}`;

            // Fetch vet name
            let vetName = "Unzugewiesen";
            if (vet?.id) {
              const [vetData] = await ctx.db
                .select({ firstName: users.firstName, lastName: users.lastName })
                .from(users)
                .where(eq(users.id, vet.id))
                .limit(1);
              if (vetData) {
                vetName = `${vetData.firstName} ${vetData.lastName}`;
              }
            }

            const bookingNotifInput: SendBookingNotificationInput = {
              to: tenantData.tenantEmail,
              practiceName: tenantData.tenantName,
              ownerFirstName: owner.firstName,
              ownerLastName: owner.lastName,
              patientName: patient.name,
              patientSpecies: patient.species,
              appointmentDate: dateStr,
              appointmentDateTime: dateTimeStr,
              vetName,
            };

            await sendBookingNotificationEmail(bookingNotifInput);
          }
        }
      } catch (emailError) {
        // Log error but don't fail the booking
        console.error("Failed to send booking notification email:", emailError);
      }

      // Send booking request email to owner for email confirmation (fire and forget)
      try {
        const [tenantForRequest] = await ctx.db
          .select({ tenantName: tenants.name })
          .from(tenants)
          .where(eq(tenants.id, input.tenantId))
          .limit(1);

        if (tenantForRequest) {
          const [requestSettings] = await ctx.db
            .select({ confirmationEmailEnabled: emailSettings.confirmationEmailEnabled })
            .from(emailSettings)
            .where(eq(emailSettings.tenantId, input.tenantId))
            .limit(1);

          if (requestSettings?.confirmationEmailEnabled !== false && owner.email) {
            const startDate = new Date(appointment.startTime);
            const dateStr = startDate.toLocaleDateString("de-DE", {
              weekday: "long",
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
            });
            const timeStr = startDate.toLocaleTimeString("de-DE", {
              hour: "2-digit",
              minute: "2-digit",
            });
            const confirmToken = generateConfirmationToken(appointment.id, owner.email, "confirm");
            const cancelToken = generateConfirmationToken(appointment.id, owner.email, "cancel");
            const baseUrl = getMainDomain();

            const requestEmailInput: SendBookingRequestEmailInput = {
              to: owner.email,
              practiceName: tenantForRequest.tenantName,
              ownerFirstName: owner.firstName ?? input.owner.firstName,
              patientName: patient.name,
              patientSpecies: patient.species,
              appointmentDate: dateStr,
              appointmentTime: timeStr,
              appointmentDateTime: `${dateStr} um ${timeStr}`,
              confirmUrl: buildConfirmationUrl(confirmToken, baseUrl, "confirm"),
              cancelUrl: buildConfirmationUrl(cancelToken, baseUrl, "cancel"),
            };

            await sendBookingRequestEmail(requestEmailInput);
          }
        }
      } catch (emailError) {
        console.error("Failed to send booking request email:", emailError);
      }

      return {
        appointmentId: appointment.id,
        startTime: appointment.startTime,
        endTime: appointment.endTime,
        patientName: patient.name,
        ownerName: `${owner.firstName} ${owner.lastName}`,
        ownerEmail: owner.email,
      };
    }),

  // ─── Slot-Hold Procedures ──────────────────────────────────────────────────

  /** Public: Reserve a slot for 15 minutes — returns holdToken */
  holdSlot: publicBookingProcedure
    .input(
      z.object({
        tenantId: z.string().uuid(),
        slotDatetime: z.date(),
        vetId: z.string().uuid().optional(),
        browserSessionId: z.string().uuid(),
        embeddingOrigin: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await assertEmbeddingOriginAllowed(ctx.db, ctx.headers, {
        tenantId: input.tenantId,
        embeddingOrigin: input.embeddingOrigin,
      });

      let slotDurationMin = 30;
      if (input.vetId) {
        const [vet] = await ctx.db
          .select({ slotDurationMin: users.slotDurationMin })
          .from(users)
          .where(eq(users.id, input.vetId))
          .limit(1);
        if (vet) slotDurationMin = vet.slotDurationMin;
      }

      const scheduleService = createScheduleService(ctx.db);
      try {
        return await scheduleService.reserveSlot({
          tenantId: input.tenantId,
          vetId: input.vetId,
          slotStart: input.slotDatetime,
          durationMin: slotDurationMin,
          browserSessionId: input.browserSessionId,
          holdTtlMin: 15,
        });
      } catch (error) {
        if (error instanceof Error && error.message === "slot_held") {
          throw new TRPCError({
            code: "CONFLICT",
            message: "Dieser Termin wird gerade von jemand anderem gebucht. Bitte wählen Sie einen anderen Slot.",
          });
        }
        if (error instanceof Error && error.message === "slot_booked") {
          throw new TRPCError({
            code: "CONFLICT",
            message: "Dieser Termin ist bereits gebucht. Bitte wählen Sie einen anderen Slot.",
          });
        }
        throw error;
      }
    }),

  /** Public: Release a hold (user went back or navigated away) */
  releaseHold: publicProcedure
    .input(
      z.object({
        holdToken: z.string().uuid(),
        embeddingOrigin: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [hold] = await ctx.db
        .select({ tenantId: appointmentHolds.tenantId })
        .from(appointmentHolds)
        .where(eq(appointmentHolds.sessionToken, input.holdToken))
        .limit(1);

      if (hold?.tenantId) {
        await assertEmbeddingOriginAllowed(ctx.db, ctx.headers, {
          tenantId: hold.tenantId,
          embeddingOrigin: input.embeddingOrigin,
        });
      }

      await ctx.db
        .delete(appointmentHolds)
        .where(eq(appointmentHolds.sessionToken, input.holdToken));
      return { success: true };
    }),

  /** Public: Check if a slot is available (no active hold + no booking) */
  checkSlotAvailability: publicProcedure
    .input(
      z.object({
        tenantId: z.string().uuid(),
        slotDatetime: z.date(),
        vetId: z.string().uuid().optional(),
        embeddingOrigin: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      await assertEmbeddingOriginAllowed(ctx.db, ctx.headers, {
        tenantId: input.tenantId,
        embeddingOrigin: input.embeddingOrigin,
      });

      const scheduleService = createScheduleService(ctx.db);
      return scheduleService.checkSlotAvailability({
        tenantId: input.tenantId,
        vetId: input.vetId,
        slotDatetime: input.slotDatetime,
      });
    }),

  /** Public: Check which vets have available slots in next 14 days */
  getVetAvailability: publicProcedure
    .input(
      z.object({
        tenantId: z.string().uuid(),
        embeddingOrigin: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      await assertEmbeddingOriginAllowed(ctx.db, ctx.headers, {
        tenantId: input.tenantId,
        embeddingOrigin: input.embeddingOrigin,
      });

      const scheduleService = createScheduleService(ctx.db);
      return scheduleService.getVetAvailability(input.tenantId);
    }),

  getEmbedCode: publicProcedure
    .input(z.object({ slug: z.string().min(1) }))
    .query(({ input }) => {
      const bookingUrl = `${getMainDomain()}/book/${input.slug}`;

      const iframeCode = `<iframe src="${bookingUrl}" width="100%" height="600" frameborder="0" style="border:none;border-radius:8px" allow="payment"></iframe>`;

      const modalCode = `<div id="vet-cloud-booking"></div>
<script>
  (function() {
    const button = document.createElement('button');
    button.textContent = 'Termin buchen';
    button.style.cssText = 'padding:10px 20px;background:#007bff;color:white;border:none;border-radius:4px;cursor:pointer;font-size:14px';
    button.onmouseover = () => button.style.background = '#0056b3';
    button.onmouseout = () => button.style.background = '#007bff';

    button.onclick = () => {
      const modal = document.createElement('div');
      modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:10000';

      const container = document.createElement('div');
      container.style.cssText = 'width:90%;height:90%;max-width:600px;background:white;border-radius:8px;overflow:hidden;box-shadow:0 10px 40px rgba(0,0,0,0.2);display:flex;flex-direction:column';

      const closeBtn = document.createElement('button');
      closeBtn.textContent = '✕';
      closeBtn.style.cssText = 'position:absolute;top:10px;right:10px;background:none;border:none;font-size:24px;cursor:pointer;color:#666;width:32px;height:32px';
      closeBtn.onclick = () => document.body.removeChild(modal);

      const iframe = document.createElement('iframe');
      iframe.src = '${bookingUrl}';
      iframe.style.cssText = 'width:100%;height:100%;border:none;flex:1';

      container.appendChild(closeBtn);
      container.appendChild(iframe);
      modal.appendChild(container);
      modal.onclick = (e) => e.target === modal && document.body.removeChild(modal);
      document.body.appendChild(modal);
    };

    const container = document.getElementById('vet-cloud-booking');
    if (container) container.appendChild(button);
  })();
<\/script>`;

      return {
        iframeCode,
        modalCode,
        bookingUrl,
      };
    }),
});
