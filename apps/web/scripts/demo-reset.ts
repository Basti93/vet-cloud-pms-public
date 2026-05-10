/**
 * Demo reset utility: Set demo slug + fully bootstrap demo tenant.
 *
 * Usage:
 *   - Set slug once: npx tsx scripts/demo-reset.ts --set-slug
 *   - Full reset:    npx tsx scripts/demo-reset.ts --reset
 */

import fs from "fs";
import path from "path";
import crypto from "crypto";
import dotenv from "dotenv";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { createDefaultRoles } from "@/lib/auth/permissions";
import {
  appointmentEmailLogs,
  appointmentHolds,
  appointments,
  diagnoses,
  medications,
  owners,
  patients,
  roles,
  tenants,
  userRoles,
  users,
  vaccinationEmailLogs,
  vaccinations,
  vetAbsences,
  vetSchedules,
  vitals,
  voiceCalls,
} from "@/lib/db/schema";
import {
  resetDemoTenantData,
  type DemoVetUser,
} from "@/lib/demo/reset-demo-tenant";
import {
  TEST_DATA,
  DEMO_TENANT_ID,
  DEMO_TENANT_SLUG,
  getTestDataStats,
} from "./test-data";

// Load .env.local with dotenv (handles quoted values and special chars correctly)
const envPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, override: true });
}

type DemoUser = (typeof TEST_DATA.users)[number];
type ClerkUpsertResult = {
  clerkId: string;
  created: boolean;
};

async function clerkRequest<T>(secretKey: string, apiPath: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`https://api.clerk.com/v1${apiPath}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Clerk API ${response.status} ${response.statusText}: ${text}`);
  }

  return (await response.json()) as T;
}

async function upsertClerkUser(secretKey: string, user: DemoUser): Promise<ClerkUpsertResult> {
  const email = user.email.trim().toLowerCase();
  const query = new URLSearchParams({ "email_address[]": email });
  const existing = await clerkRequest<
    Array<{
      id: string;
      email_addresses?: Array<{ email_address?: string }>;
    }>
  >(secretKey, `/users?${query.toString()}`);

  const exactMatch = existing.find((existingUser) =>
    (existingUser.email_addresses ?? []).some(
      (entry) => (entry.email_address ?? "").trim().toLowerCase() === email
    )
  );

  if (exactMatch) {
    return { clerkId: exactMatch.id, created: false };
  }

  const generatedPassword =
    process.env.DEMO_USERS_PASSWORD || `Demo-${crypto.randomBytes(12).toString("base64url")}!9a`;

  const created = await clerkRequest<{ id: string }>(secretKey, "/users", {
    method: "POST",
    body: JSON.stringify({
      external_id: `demo-${user.role}-${email}`,
      email_address: [email],
      first_name: user.firstName ?? undefined,
      last_name: user.lastName ?? undefined,
      password: generatedPassword,
      skip_password_checks: true,
      skip_password_requirement: false,
      public_metadata: {
        demoSeed: true,
        demoRole: user.role,
      },
      private_metadata: {
        seededBy: "demo-reset.ts",
      },
    }),
  });

  return { clerkId: created.id, created: true };
}

async function setClerkUserPassword(
  secretKey: string,
  clerkUserId: string,
  password: string
): Promise<void> {
  await clerkRequest(secretKey, `/users/${clerkUserId}`, {
    method: "PATCH",
    body: JSON.stringify({
      password,
      skip_password_checks: true,
      skip_password_requirement: false,
    }),
  });
}

async function disableClerkUserMfa(secretKey: string, clerkUserId: string): Promise<void> {
  try {
    await fetch(`https://api.clerk.com/v1/users/${clerkUserId}/mfa`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${secretKey}`,
      },
    });
  } catch (error) {
    console.warn(`  - ${clerkUserId}: failed to disable MFA enrollments`, error);
  }
}

async function ensureDemoClerkUsers(usersToCreate: DemoUser[]): Promise<DemoUser[]> {
  const clerkSecretKey = process.env.CLERK_SECRET_KEY;
  if (!clerkSecretKey) {
    throw new Error("CLERK_SECRET_KEY missing. Required to auto-create demo users in Clerk.");
  }

  console.log("🔐 Ensuring demo users exist in Clerk...");

  const withIds: DemoUser[] = [];
  let createdCount = 0;
  let reusedCount = 0;
  const demoPassword = process.env.DEMO_USERS_PASSWORD?.trim();

  for (const user of usersToCreate) {
    const { clerkId, created } = await upsertClerkUser(clerkSecretKey, user);
    await disableClerkUserMfa(clerkSecretKey, clerkId);

    if (demoPassword) {
      await setClerkUserPassword(clerkSecretKey, clerkId, demoPassword);
    }

    if (created) createdCount++;
    else reusedCount++;

    console.log(`  - ${user.email}: ${created ? "created" : "reused"} (${clerkId})`);
    withIds.push({ ...user, clerkId });
  }

  console.log(
    `  ✓ Clerk users ensured: ${withIds.length} (created: ${createdCount}, reused: ${reusedCount})`
  );
  if (demoPassword) {
    console.log("  ✓ Demo user passwords synchronized from DEMO_USERS_PASSWORD");
  }

  return withIds;
}

function getDatabaseHost(): string {
  const url = process.env.DATABASE_URL;
  if (!url) return "unknown";
  try {
    return new URL(url).host;
  } catch {
    return "unknown";
  }
}

async function closeDbConnections(): Promise<void> {
  try {
    const client = (db as unknown as { $client?: { end?: (opts?: unknown) => Promise<void> } })
      .$client;
    if (client?.end) {
      await client.end({ timeout: 1 });
    }
  } catch (error) {
    console.warn("⚠️ Failed to close DB client cleanly:", error);
  }
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("❌ DATABASE_URL not set");
    process.exit(1);
  }

  const command = process.argv[2];
  let exitCode = 0;

  try {
    if (command === "--set-slug") {
      console.log(`🔄 Setting demo tenant slug to "${DEMO_TENANT_SLUG}"...`);

      const [tenant] = await db
        .update(tenants)
        .set({ slug: DEMO_TENANT_SLUG })
        .where(eq(tenants.id, DEMO_TENANT_ID))
        .returning();

      if (!tenant) {
        throw new Error("Demo tenant not found");
      }

      console.log("✅ Success!");
      console.log(`📌 Booking URL: /book/${DEMO_TENANT_SLUG}`);
      return;
    }

    if (command !== "--reset") {
      console.log("Usage:");
      console.log("  npx tsx scripts/demo-reset.ts --set-slug    # Set demo slug once");
      console.log("  npx tsx scripts/demo-reset.ts --reset       # Full demo tenant reset");
      exitCode = 1;
      return;
    }

    console.log("🔄 Resetting demo tenant data...");
    console.log(`🧭 DATABASE host: ${getDatabaseHost()}`);

    // Clear tenant data before deleting users to avoid FK nulling errors
    await db
      .delete(appointmentEmailLogs)
      .where(eq(appointmentEmailLogs.tenantId, DEMO_TENANT_ID));
    await db
      .delete(vaccinationEmailLogs)
      .where(eq(vaccinationEmailLogs.tenantId, DEMO_TENANT_ID));
    await db.delete(appointmentHolds).where(eq(appointmentHolds.tenantId, DEMO_TENANT_ID));
    await db.delete(vetAbsences).where(eq(vetAbsences.tenantId, DEMO_TENANT_ID));
    await db.delete(vetSchedules).where(eq(vetSchedules.tenantId, DEMO_TENANT_ID));
    await db.delete(voiceCalls).where(eq(voiceCalls.tenantId, DEMO_TENANT_ID));
    await db.delete(medications).where(eq(medications.tenantId, DEMO_TENANT_ID));
    await db.delete(vitals).where(eq(vitals.tenantId, DEMO_TENANT_ID));
    await db.delete(diagnoses).where(eq(diagnoses.tenantId, DEMO_TENANT_ID));
    await db.delete(vaccinations).where(eq(vaccinations.tenantId, DEMO_TENANT_ID));
    await db.delete(appointments).where(eq(appointments.tenantId, DEMO_TENANT_ID));
    await db.delete(patients).where(eq(patients.tenantId, DEMO_TENANT_ID));
    await db.delete(owners).where(eq(owners.tenantId, DEMO_TENANT_ID));

    const rolesCount = await db.delete(roles).where(eq(roles.tenantId, DEMO_TENANT_ID));
    const usersCount = await db.delete(users).where(eq(users.tenantId, DEMO_TENANT_ID));

    await createDefaultRoles(DEMO_TENANT_ID);

    const usersToCreate = await ensureDemoClerkUsers([...TEST_DATA.users]);

    const createdUsers = await Promise.all(
      usersToCreate.map((user) =>
        db
          .insert(users)
          .values({
            clerkId: user.clerkId,
            tenantId: user.tenantId,
            email: user.email,
            title: user.title,
            firstName: user.firstName,
            lastName: user.lastName,
            active: true,
          })
          .onConflictDoUpdate({
            target: users.clerkId,
            set: {
              tenantId: user.tenantId,
              email: user.email,
              title: user.title,
              firstName: user.firstName,
              lastName: user.lastName,
              active: true,
              updatedAt: new Date(),
            },
          })
          .returning()
          .then((result) => result[0])
      )
    );

    console.log("🔐 Assigning roles to users...");
    const rolesByCode = (
      await db
        .select({
          id: roles.id,
          code: roles.code,
        })
        .from(roles)
        .where(eq(roles.tenantId, DEMO_TENANT_ID))
    ).reduce(
      (acc, role) => {
        acc[role.code.toLowerCase()] = role.id;
        return acc;
      },
      {} as Record<string, string>
    );

    await Promise.all(
      createdUsers.map((createdUser, index) => {
        if (!createdUser) return Promise.resolve(null);

        const roleCodes = [
          usersToCreate[index].role,
          ...(usersToCreate[index].additionalRoles ?? []),
        ];

        return Promise.all(
          roleCodes.map((roleCode) => {
            const roleId = rolesByCode[roleCode.toLowerCase()];
            if (!roleId) return Promise.resolve(null);

            return db
              .insert(userRoles)
              .values({
                userId: createdUser.id,
                roleId,
                assignedBy: createdUser.id,
              })
              .onConflictDoNothing();
          })
        );
      })
    );
    console.log("  ✓ Roles assigned\n");

    const createdVets: DemoVetUser[] = [];
    createdUsers.forEach((createdUser, index) => {
      if (!createdUser) return;
      if (usersToCreate[index].role !== "vet") return;
      createdVets.push({
        id: createdUser.id,
        email: createdUser.email,
      });
    });

    if (createdVets.length === 0) {
      throw new Error("No vet users created");
    }

    const summary = await resetDemoTenantData({
      db,
      vetUsers: createdVets,
      now: new Date(),
      seedVaccinationTypesFirst: true,
    });

    const stats = getTestDataStats();

    console.log("✅ Reset complete!");
    console.log("📊 Deleted:");
    console.log(`   - Users: ${usersCount.count || 0}`);
    console.log(`   - Roles (with permissions): ${rolesCount.count || 0}`);
    console.log(`   - Appointment email logs: ${summary.deleted.appointmentEmailLogs}`);
    console.log(`   - Vaccination email logs: ${summary.deleted.vaccinationEmailLogs}`);
    console.log(`   - Appointment holds: ${summary.deleted.appointmentHolds}`);
    console.log(`   - Vet absences: ${summary.deleted.vetAbsences}`);
    console.log(`   - Vet schedules: ${summary.deleted.vetSchedules}`);
    console.log(`   - Voice calls: ${summary.deleted.voiceCalls}`);
    console.log(`   - Medications: ${summary.deleted.medications}`);
    console.log(`   - Vitals: ${summary.deleted.vitals}`);
    console.log(`   - Diagnoses: ${summary.deleted.diagnoses}`);
    console.log(`   - Vaccinations: ${summary.deleted.vaccinations}`);
    console.log(`   - Appointments: ${summary.deleted.appointments}`);
    console.log(`   - Patients: ${summary.deleted.patients}`);
    console.log(`   - Owners: ${summary.deleted.owners}`);

    console.log("📊 Created test data:");
    console.log("   - Roles: Admin, Vet, Receptionist");
    console.log(`   - Users: ${createdUsers.length} (${stats.vets} vets)`);
    console.log(`   - Vet schedules: ${summary.created.vetSchedules}`);
    console.log(`   - Vet absences: ${summary.created.vetAbsences}`);
    console.log(`   - Owners: ${summary.created.owners}`);
    console.log(`   - Patients: ${summary.created.patients}`);
    console.log(
      `   - Appointments: ${stats.internalAppointments} internal + ${stats.onlineBookings} bookings`
    );
    console.log(`   - Diagnoses: ${summary.created.diagnoses}`);
    console.log(`   - Medications: ${summary.created.medications}`);
    console.log(`   - Vitals: ${summary.created.vitals}`);
    console.log(`   - Vaccinations: ${summary.created.vaccinations}`);

    console.log("🔎 Persisted verification (demo tenant):");
    console.log(`   - Users: ${summary.verification.users}`);
    console.log(`   - Owners: ${summary.verification.owners}`);
    console.log(`   - Patients: ${summary.verification.patients}`);
    console.log(`   - Appointments: ${summary.verification.appointments}`);
    console.log(`   - Vaccinations: ${summary.verification.vaccinations}`);
    console.log(`   - Vet schedules: ${summary.verification.vetSchedules}`);
    console.log(`   - Vet absences: ${summary.verification.vetAbsences}`);
    console.log(
      `   - Appointment range: ${summary.verification.appointmentRange.minStartIso} -> ${summary.verification.appointmentRange.maxStartIso}`
    );
  } catch (error) {
    console.error("❌ Error:", error);
    exitCode = 1;
  } finally {
    await closeDbConnections();
    process.exit(exitCode);
  }
}

main();
