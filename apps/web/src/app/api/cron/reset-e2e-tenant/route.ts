import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { and, eq, inArray } from "drizzle-orm";
import { createDefaultRoles } from "@/lib/auth/permissions";
import { adminDb as db } from "@/lib/db/client";
import {
  appointments,
  appointmentEmailLogs,
  appointmentHolds,
  diagnoses,
  emailSettings,
  medications,
  owners,
  patients,
  PERMISSIONS,
  rolePermissions,
  roles,
  tenants,
  userRoles,
  users,
  vaccinations,
  vaccinationEmailLogs,
  vetAbsences,
  vetSchedules,
  vitals,
  voiceCalls,
} from "@/lib/db/schema";
import { TEST_DATA } from "../../../../../scripts/test-data";

const CRON_SECRET = process.env.CRON_SECRET;
const E2E_VET_CLERK_ID = "user_e2e_seed_vet";
const E2E_VET_EMAIL = "user+e2e-vet@example.com";
const E2E_SECOND_VET_CLERK_ID = "user_e2e_seed_vet_2";
const E2E_SECOND_VET_EMAIL = "user+e2e-vet-2@example.com";

/**
 * Seeds (if not yet present) then resets transient data for the E2E test tenant.
 *
 * First run: creates tenant + admin role + user + email settings (idempotent upserts).
 * Every run: deletes all transient data (patients, appointments, etc.).
 *
 * Auth: Bearer <CRON_SECRET>
 *
 * Required env vars (Coolify staging):
 *   E2E_TENANT_ID, E2E_TENANT_SLUG, E2E_CLERK_USER_ID, E2E_EMAIL
 */
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!CRON_SECRET || authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenantId = process.env.E2E_TENANT_ID;
  const tenantSlug = process.env.E2E_TENANT_SLUG;
  const clerkUserId = process.env.E2E_CLERK_USER_ID;
  const email = process.env.E2E_EMAIL;

  if (!tenantId || !tenantSlug || !clerkUserId || !email) {
    return NextResponse.json(
      {
        error: "Missing env vars",
        missing: {
          tenantId: !tenantId,
          tenantSlug: !tenantSlug,
          clerkUserId: !clerkUserId,
          email: !email,
        },
      },
      { status: 500 }
    );
  }

  try {
    const seeded = await seedE2ETenant({ tenantId, tenantSlug, clerkUserId, email });
    const deleted = await deleteE2ETenantData(tenantId);
    const created = await seedE2ETenantDemoData(tenantId, seeded.vetIds);
    const readiness = await assertE2EReadiness({
      tenantId,
      clerkUserId,
      previewToken: seeded.previewToken,
      seeded,
      created,
    });

    return NextResponse.json({
      success: true,
      tenantId,
      previewToken: seeded.previewToken,
      seeded,
      deleted,
      created,
      readiness,
    });
  } catch (error) {
    console.error("E2E tenant reset failed:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to reset E2E tenant",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

async function seedE2ETenant({
  tenantId,
  tenantSlug,
  clerkUserId,
  email,
}: {
  tenantId: string;
  tenantSlug: string;
  clerkUserId: string;
  email: string;
}) {
  // 1. Tenant
  await db
    .insert(tenants)
    .values({
      id: tenantId,
      name: "E2E Test Praxis",
      slug: tenantSlug,
      email,
      phone: "+49 30 000000",
      address: "Teststraße 1",
      city: "Berlin",
      postalCode: "10115",
      country: "DE",
      subscriptionStatus: "active",
      subscriptionPlan: "solo",
      maxUsers: 5,
      trialEndsAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    })
    .onConflictDoNothing();

  const previewToken = await ensurePreviewToken(tenantId);

  // 2. System roles needed by authenticated dashboard and public booking.
  // This syncs role permissions too; manually upserting roles leaves the E2E
  // admin unable to access settings/team/subscription pages after a reset.
  await createDefaultRoles(tenantId);

  const roleRows = await db
    .select({ id: roles.id, code: roles.code })
    .from(roles)
    .where(eq(roles.tenantId, tenantId))
    .limit(20);

  const adminRole = roleRows.find((role) => role.code === "admin");
  const vetRole = roleRows.find((role) => role.code === "vet");

  if (!adminRole) throw new Error("Admin role not found after upsert");
  if (!vetRole) throw new Error("Vet role not found after upsert");

  // 3. User — clerk_id unique constraint, safe to upsert
  await db
    .insert(users)
    .values({
      tenantId,
      clerkId: clerkUserId,
      email,
      firstName: "E2E",
      lastName: "Test",
      active: true,
    })
    .onConflictDoNothing();

  await db
    .insert(users)
    .values({
      tenantId,
      clerkId: E2E_SECOND_VET_CLERK_ID,
      email: E2E_SECOND_VET_EMAIL,
      title: "Dr.",
      firstName: "E2E",
      lastName: "Backup",
      active: true,
      slotDurationMin: 30,
    })
    .onConflictDoNothing();

  await db
    .insert(users)
    .values({
      tenantId,
      clerkId: E2E_VET_CLERK_ID,
      email: E2E_VET_EMAIL,
      title: "Dr.",
      firstName: "E2E",
      lastName: "Vet",
      active: true,
      slotDurationMin: 30,
    })
    .onConflictDoNothing();

  const user = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.clerkId, clerkUserId))
    .limit(1);

  if (!user[0]) throw new Error("E2E user not found after upsert");

  await db
    .update(users)
    .set({ tenantId, active: true, updatedAt: new Date() })
    .where(eq(users.id, user[0].id));

  const [vetUser] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.clerkId, E2E_VET_CLERK_ID))
    .limit(1);

  if (!vetUser) throw new Error("E2E vet user not found after upsert");

  const [secondVetUser] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.clerkId, E2E_SECOND_VET_CLERK_ID))
    .limit(1);

  if (!secondVetUser) throw new Error("Second E2E vet user not found after upsert");

  await db
    .update(users)
    .set({ tenantId, active: true, slotDurationMin: 30, updatedAt: new Date() })
    .where(eq(users.id, vetUser.id));

  await db
    .update(users)
    .set({ tenantId, active: true, slotDurationMin: 30, updatedAt: new Date() })
    .where(eq(users.id, secondVetUser.id));

  // 4. Role assignment
  await db
    .insert(userRoles)
    .values({ userId: user[0].id, roleId: adminRole.id })
    .onConflictDoNothing();

  await db
    .insert(userRoles)
    .values({ userId: vetUser.id, roleId: vetRole.id })
    .onConflictDoNothing();

  await db
    .insert(userRoles)
    .values({ userId: secondVetUser.id, roleId: vetRole.id })
    .onConflictDoNothing();

  // 5. Email settings (expected by dashboard queries)
  await db
    .insert(emailSettings)
    .values({
      tenantId,
      confirmationEmailEnabled: false,
      reminderEmailEnabled: false,
      bookingNotificationEnabled: false,
      reminderHoursBefore: 24,
    })
    .onConflictDoNothing();

  await db
    .update(emailSettings)
    .set({
      confirmationEmailEnabled: false,
      reminderEmailEnabled: false,
      bookingNotificationEnabled: false,
      updatedAt: new Date(),
    })
    .where(eq(emailSettings.tenantId, tenantId));

  return {
    tenant: tenantSlug,
    previewToken,
    userId: user[0].id,
    roleId: adminRole.id,
    vetIds: [vetUser.id, secondVetUser.id],
  };
}

async function ensurePreviewToken(tenantId: string) {
  const [tenant] = await db
    .select({ previewToken: tenants.previewToken })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);

  if (tenant?.previewToken) return tenant.previewToken;

  const previewToken = randomBytes(32).toString("hex");
  await db
    .update(tenants)
    .set({ previewToken, updatedAt: new Date() })
    .where(eq(tenants.id, tenantId));

  return previewToken;
}

async function assertE2EReadiness({
  tenantId,
  clerkUserId,
  previewToken,
  seeded,
  created,
}: {
  tenantId: string;
  clerkUserId: string;
  previewToken: string;
  seeded: Awaited<ReturnType<typeof seedE2ETenant>>;
  created: Awaited<ReturnType<typeof seedE2ETenantDemoData>>;
}) {
  const requiredPermissions = [
    PERMISSIONS.APPOINTMENTS_CREATE,
    PERMISSIONS.APPOINTMENTS_READ,
    PERMISSIONS.APPOINTMENTS_UPDATE,
    PERMISSIONS.PATIENTS_CREATE,
    PERMISSIONS.PATIENTS_READ,
    PERMISSIONS.SETTINGS_MANAGE,
    PERMISSIONS.USERS_MANAGE,
  ];

  const [user] = await db
    .select({ id: users.id, tenantId: users.tenantId, active: users.active })
    .from(users)
    .where(eq(users.clerkId, clerkUserId))
    .limit(1);

  const permissionRows = user
    ? await db
        .select({ permission: rolePermissions.permission })
        .from(userRoles)
        .innerJoin(rolePermissions, eq(rolePermissions.roleId, userRoles.roleId))
        .where(
          and(
            eq(userRoles.userId, user.id),
            inArray(rolePermissions.permission, requiredPermissions)
          )
        )
    : [];

  const permissions = new Set(permissionRows.map((row) => row.permission));
  const missingPermissions = requiredPermissions.filter(
    (permission) => !permissions.has(permission)
  );

  const checks = {
    previewToken: previewToken.length > 0,
    userExists: Boolean(user),
    userInTenant: user?.tenantId === tenantId,
    userActive: user?.active === true,
    adminPermissions: missingPermissions.length === 0,
    vetsSeeded: seeded.vetIds.length >= 2,
    schedulesSeeded: created.vetSchedules >= 10,
    patientsSeeded: created.patients > 0,
  };

  const ok = Object.values(checks).every(Boolean);
  if (!ok) {
    throw new Error(
      `E2E readiness failed: ${JSON.stringify({
        checks,
        missingPermissions,
      })}`
    );
  }

  return {
    ok,
    checks,
    missingPermissions,
  };
}

const toCount = (value: unknown) => Number(value ?? 0);

async function deleteE2ETenantData(tenantId: string) {
  const vaccinationEmailLogsResult = await db
    .delete(vaccinationEmailLogs)
    .where(eq(vaccinationEmailLogs.tenantId, tenantId));
  const appointmentEmailLogsResult = await db
    .delete(appointmentEmailLogs)
    .where(eq(appointmentEmailLogs.tenantId, tenantId));
  const appointmentHoldsResult = await db
    .delete(appointmentHolds)
    .where(eq(appointmentHolds.tenantId, tenantId));
  const vetAbsencesResult = await db
    .delete(vetAbsences)
    .where(eq(vetAbsences.tenantId, tenantId));
  const vetSchedulesResult = await db
    .delete(vetSchedules)
    .where(eq(vetSchedules.tenantId, tenantId));
  const voiceCallsResult = await db
    .delete(voiceCalls)
    .where(eq(voiceCalls.tenantId, tenantId));
  const medicationsResult = await db
    .delete(medications)
    .where(eq(medications.tenantId, tenantId));
  const vitalsResult = await db
    .delete(vitals)
    .where(eq(vitals.tenantId, tenantId));
  const diagnosesResult = await db
    .delete(diagnoses)
    .where(eq(diagnoses.tenantId, tenantId));
  const vaccinationsResult = await db
    .delete(vaccinations)
    .where(eq(vaccinations.tenantId, tenantId));
  const appointmentsResult = await db
    .delete(appointments)
    .where(eq(appointments.tenantId, tenantId));
  const patientsResult = await db
    .delete(patients)
    .where(eq(patients.tenantId, tenantId));
  const ownersResult = await db
    .delete(owners)
    .where(eq(owners.tenantId, tenantId));

  return {
    vaccinationEmailLogs: toCount(vaccinationEmailLogsResult.count),
    appointmentEmailLogs: toCount(appointmentEmailLogsResult.count),
    appointmentHolds: toCount(appointmentHoldsResult.count),
    vetAbsences: toCount(vetAbsencesResult.count),
    vetSchedules: toCount(vetSchedulesResult.count),
    voiceCalls: toCount(voiceCallsResult.count),
    medications: toCount(medicationsResult.count),
    vitals: toCount(vitalsResult.count),
    diagnoses: toCount(diagnosesResult.count),
    vaccinations: toCount(vaccinationsResult.count),
    appointments: toCount(appointmentsResult.count),
    patients: toCount(patientsResult.count),
    owners: toCount(ownersResult.count),
  };
}

async function seedE2ETenantDemoData(tenantId: string, vetIds: string[]) {
  const createdOwners = await Promise.all(
    TEST_DATA.owners.map((owner) =>
      db
        .insert(owners)
        .values({ tenantId, ...owner, active: true })
        .returning()
        .then((result) => result[0]!)
    )
  );

  const createdPatients = await Promise.all(
    TEST_DATA.patients.map(({ ownerIndex, ...patientData }) =>
      db
        .insert(patients)
        .values({
          tenantId,
          ownerId: createdOwners[ownerIndex]!.id,
          ...patientData,
          birthDate: new Date(new Date().getFullYear() - 3, 0, 1),
          active: true,
        })
        .returning()
        .then((result) => result[0]!)
    )
  );

  await seedDeterministicBookingAvailability(tenantId, vetIds);
  const seededBooking = await seedPendingOnlineBooking(tenantId, vetIds[0]!, createdPatients[0]!.id);

  return {
    owners: createdOwners.length,
    patients: createdPatients.length,
    vetSchedules: vetIds.length * 5,
    pendingBookingId: seededBooking.id,
  };
}

async function seedDeterministicBookingAvailability(tenantId: string, vetIds: string[]) {
  const weekdaySlots = [{ startHour: 9, startMin: 0, endHour: 17, endMin: 0 }];
  await db
    .update(tenants)
    .set({
      timezone: "Europe/Berlin",
      consultationHours: [
        { dayOfWeek: 0, slots: [] },
        { dayOfWeek: 1, slots: weekdaySlots },
        { dayOfWeek: 2, slots: weekdaySlots },
        { dayOfWeek: 3, slots: weekdaySlots },
        { dayOfWeek: 4, slots: weekdaySlots },
        { dayOfWeek: 5, slots: weekdaySlots },
        { dayOfWeek: 6, slots: [] },
      ],
      openingHours: [
        { dayOfWeek: 0, slots: [] },
        { dayOfWeek: 1, slots: weekdaySlots },
        { dayOfWeek: 2, slots: weekdaySlots },
        { dayOfWeek: 3, slots: weekdaySlots },
        { dayOfWeek: 4, slots: weekdaySlots },
        { dayOfWeek: 5, slots: weekdaySlots },
        { dayOfWeek: 6, slots: [] },
      ],
      updatedAt: new Date(),
    })
    .where(eq(tenants.id, tenantId));

  await Promise.all(
    vetIds.flatMap((vetId) =>
      [1, 2, 3, 4, 5].map((dayOfWeek) =>
        db.insert(vetSchedules).values({
          tenantId,
          vetId,
          dayOfWeek,
          slots: weekdaySlots,
          notes: "E2E deterministic booking schedule",
        })
      )
    )
  );
}

async function seedPendingOnlineBooking(tenantId: string, vetId: string, patientId: string) {
  const startTime = nextWeekdayAtLocalHour(9);
  const endTime = new Date(startTime.getTime() + 30 * 60_000);
  const [booking] = await db
    .insert(appointments)
    .values({
      tenantId,
      patientId,
      vetId,
      startTime,
      endTime,
      title: "E2E pending booking request",
      source: "online_booking",
      status: "pending-confirmation",
    })
    .returning();

  return booking;
}

function nextWeekdayAtLocalHour(hour: number) {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  while (date.getDay() === 0 || date.getDay() === 6) {
    date.setDate(date.getDate() + 1);
  }
  date.setHours(hour, 0, 0, 0);
  return date;
}

export const maxDuration = 60;
