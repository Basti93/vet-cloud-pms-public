import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  appointments,
  appointmentEmailLogs,
  appointmentHolds,
  diagnoses,
  emailSettings,
  medications,
  owners,
  patients,
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

const CRON_SECRET = process.env.CRON_SECRET;

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

    return NextResponse.json({ success: true, tenantId, seeded, deleted });
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
      subscriptionPlan: "starter",
      maxUsers: 5,
      trialEndsAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    })
    .onConflictDoNothing();

  // 2. Admin role
  await db
    .insert(roles)
    .values({
      tenantId,
      code: "admin",
      name: "Admin",
      description: "Full access",
      isSystem: true,
      baseVersion: 1,
    })
    .onConflictDoNothing();

  const adminRole = await db
    .select({ id: roles.id })
    .from(roles)
    .where(eq(roles.tenantId, tenantId))
    .limit(1);

  if (!adminRole[0]) throw new Error("Admin role not found after upsert");

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

  const user = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.clerkId, clerkUserId))
    .limit(1);

  if (!user[0]) throw new Error("E2E user not found after upsert");

  // 4. Role assignment
  await db
    .insert(userRoles)
    .values({ userId: user[0].id, roleId: adminRole[0].id })
    .onConflictDoNothing();

  // 5. Email settings (expected by dashboard queries)
  await db
    .insert(emailSettings)
    .values({ tenantId, reminderEmailEnabled: false, reminderHoursBefore: 24 })
    .onConflictDoNothing();

  return { tenant: tenantSlug, userId: user[0].id, roleId: adminRole[0].id };
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

export const maxDuration = 60;
