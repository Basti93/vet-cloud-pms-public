/**
 * Admin utilities: Reset demo tenant with fresh test data from test-data.ts
 *
 * Usage:
 *   - Set slug once: npx tsx scripts/admin-reset.ts --set-slug
 *   - Reset nightly: npx tsx scripts/admin-reset.ts --reset
 */

import fs from "fs";
import path from "path";
import crypto from "crypto";
import dotenv from "dotenv";

// Load .env.local with dotenv (handles quoted values and special chars correctly)
const envPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, override: true });
}

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import {
  tenants,
  appointments,
  patients,
  owners,
  voiceCalls,
  users,
  diagnoses,
  medications,
  vitals,
  vetSchedules,
  vetAbsences,
  roles,
  rolePermissions,
  userRoles,
} from "@/lib/db/schema";
import { eq, and, sql } from "drizzle-orm";
import {
  TEST_DATA,
  DEMO_TENANT_ID,
  DEMO_TENANT_SLUG,
  getTestDataStats,
} from "./test-data";
import { createDefaultRoles } from "@/lib/auth/permissions";

type DemoUser = (typeof TEST_DATA.users)[number];
type ClerkUpsertResult = {
  clerkId: string;
  created: boolean;
};

async function clerkRequest<T>(secretKey: string, path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`https://api.clerk.com/v1${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Clerk API ${res.status} ${res.statusText}: ${text}`);
  }

  return (await res.json()) as T;
}

async function upsertClerkUser(
  secretKey: string,
  user: DemoUser
): Promise<ClerkUpsertResult> {
  const email = user.email.trim().toLowerCase();
  const query = new URLSearchParams({ "email_address[]": email });
  const existing = await clerkRequest<
    Array<{
      id: string;
      email_addresses?: Array<{ email_address?: string }>;
    }>
  >(
    secretKey,
    `/users?${query.toString()}`
  );
  const exactMatch = existing.find((u) =>
    (u.email_addresses ?? []).some(
      (e) => (e.email_address ?? "").trim().toLowerCase() === email
    )
  );
  if (exactMatch) {
    return { clerkId: exactMatch.id, created: false };
  }

  const generatedPassword =
    process.env.DEMO_USERS_PASSWORD ||
    `Demo-${crypto.randomBytes(12).toString("base64url")}!9a`;

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
        seededBy: "admin-reset.ts",
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
    throw new Error(
      "CLERK_SECRET_KEY missing. Required to auto-create demo users in Clerk."
    );
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

async function main() {
  const DATABASE_URL = process.env.DATABASE_URL;
  if (!DATABASE_URL) {
    console.error("❌ DATABASE_URL not set");
    process.exit(1);
  }

  const dbUrl =
    DATABASE_URL +
    (DATABASE_URL.includes("?") ? "&sslmode=require" : "?sslmode=require");
  const pg = postgres(dbUrl, { max: 1 });
  const db = drizzle(pg, {
    schema: {
      tenants,
      appointments,
      patients,
      owners,
      voiceCalls,
      users,
      diagnoses,
      medications,
      vitals,
      vetSchedules,
      vetAbsences,
      roles,
      rolePermissions,
      userRoles,
    },
  });

  const command = process.argv[2];

  try {
    if (command === "--set-slug") {
      console.log(
        `🔄 Setting demo tenant slug to "${DEMO_TENANT_SLUG}"...`
      );
      const [tenant] = await db
        .update(tenants)
        .set({ slug: DEMO_TENANT_SLUG })
        .where(eq(tenants.id, DEMO_TENANT_ID))
        .returning();

      if (!tenant) {
        throw new Error("Demo tenant not found");
      }

      console.log(`✅ Success!`);
      console.log(`📌 Booking URL: /book/${DEMO_TENANT_SLUG}`);
    } else if (command === "--reset") {
      console.log(`🔄 Resetting demo tenant data...`);

      // Ensure demo tenant exists, then sync profile + opening hours
      const t = TEST_DATA.tenant;
      await db
        .insert(tenants)
        .values(t)
        .onConflictDoUpdate({
          target: tenants.id,
          set: {
            slug: t.slug,
            name: t.name,
            email: t.email,
            phone: t.phone,
            address: t.address,
            city: t.city,
            postalCode: t.postalCode,
            country: t.country,
            tagline: t.tagline,
            monogram: t.monogram,
            themePreference: t.themePreference,
            typographyPreference: t.typographyPreference,
            websiteTemplate: t.websiteTemplate,
            openingHours: t.openingHours,
            subscriptionStatus: t.subscriptionStatus,
            subscriptionPlan: t.subscriptionPlan,
            maxUsers: t.maxUsers,
            updatedAt: new Date(),
          },
        });

      // Delete in correct order (foreign key constraints)
      // Role permissions will be cascade-deleted when roles are deleted
      const rolesCount = await db
        .delete(roles)
        .where(eq(roles.tenantId, DEMO_TENANT_ID));

      const vetAbsencesCount = await db
        .delete(vetAbsences)
        .where(eq(vetAbsences.tenantId, DEMO_TENANT_ID));

      const vetSchedulesCount = await db
        .delete(vetSchedules)
        .where(eq(vetSchedules.tenantId, DEMO_TENANT_ID));

      const voiceCallsCount = await db
        .delete(voiceCalls)
        .where(eq(voiceCalls.tenantId, DEMO_TENANT_ID));

      const medicationsCount = await db
        .delete(medications)
        .where(eq(medications.tenantId, DEMO_TENANT_ID));

      const vitalsCount = await db
        .delete(vitals)
        .where(eq(vitals.tenantId, DEMO_TENANT_ID));

      const diagnosesCount = await db
        .delete(diagnoses)
        .where(eq(diagnoses.tenantId, DEMO_TENANT_ID));

      const appointmentsCount = await db
        .delete(appointments)
        .where(eq(appointments.tenantId, DEMO_TENANT_ID));

      const patientsCount = await db
        .delete(patients)
        .where(eq(patients.tenantId, DEMO_TENANT_ID));

      const ownersCount = await db
        .delete(owners)
        .where(eq(owners.tenantId, DEMO_TENANT_ID));

      // Delete old users (except keep structure, recreate fresh)
      const usersCount = await db
        .delete(users)
        .where(eq(users.tenantId, DEMO_TENANT_ID));

      // ────────────────────────────────────────────────────────────────────
      // CREATE DEFAULT ROLES (fresh)
      // ────────────────────────────────────────────────────────────────────
      await createDefaultRoles(DEMO_TENANT_ID);

      // ────────────────────────────────────────────────────────────────────
      // CREATE USERS (fresh from TEST_DATA)
      // ────────────────────────────────────────────────────────────────────
      const usersToCreate = await ensureDemoClerkUsers([...TEST_DATA.users]);

      const createdUsers = await Promise.all(
        usersToCreate.map((u) =>
          db
            .insert(users)
            .values({
              clerkId: u.clerkId,
              tenantId: u.tenantId,
              email: u.email,
              title: u.title,
              firstName: u.firstName,
              lastName: u.lastName,
              active: true,
            })
            .onConflictDoUpdate({
              target: users.clerkId,
              set: {
                tenantId: u.tenantId,
                email: u.email,
                title: u.title,
                firstName: u.firstName,
                lastName: u.lastName,
                active: true,
                updatedAt: new Date(),
              },
            })
            .returning()
            .then((r) => r[0])
        )
      );

      // ────────────────────────────────────────────────────────────────────
      // ASSIGN ROLES TO USERS
      // ────────────────────────────────────────────────────────────────────
      console.log("🔐 Assigning roles to users...");
      const rolesByCode = (await db.select().from(roles).where(eq(roles.tenantId, DEMO_TENANT_ID))).reduce(
        (acc, role) => {
          acc[role.code.toLowerCase()] = role.id;
          return acc;
        },
        {} as Record<string, string>
      );

      await Promise.all(
        createdUsers.map((u, idx) => {
          if (!u) return Promise.resolve(null);
          const roleId = rolesByCode[usersToCreate[idx].role.toLowerCase()];
          if (!roleId) return Promise.resolve(null);
          return db
            .insert(userRoles)
            .values({
              userId: u.id,
              roleId,
              assignedBy: u.id,
            })
            .onConflictDoNothing();
        })
      );
      console.log("  ✓ Roles assigned\n");

      const createdVets = createdUsers.filter((u, idx) => u && usersToCreate[idx].role === "vet");
      if (createdVets.length === 0) {
        throw new Error("No vet users created");
      }

      const vet = createdVets[0]!; // Use first vet as default
      const allVets = createdVets;

      const now = new Date();

      // ────────────────────────────────────────────────────────────────────
      // CREATE VET SCHEDULES
      // ────────────────────────────────────────────────────────────────────
      await Promise.all(
        TEST_DATA.vetSchedules.map((schedule) => {
          const vetForSchedule = allVets[schedule.vetIndex];
          if (!vetForSchedule) return null;
          return db.insert(vetSchedules).values({
            tenantId: DEMO_TENANT_ID,
            vetId: vetForSchedule.id,
            dayOfWeek: schedule.dayOfWeek,
            slots: schedule.slots,
          });
        })
      );

      // ────────────────────────────────────────────────────────────────────
      // CREATE VET ABSENCES
      // ────────────────────────────────────────────────────────────────────
      await Promise.all(
        TEST_DATA.vetAbsences.map((absence) => {
          const vetForAbsence = allVets[absence.vetIndex];
          if (!vetForAbsence) return null;
          return db.insert(vetAbsences).values({
            tenantId: DEMO_TENANT_ID,
            vetId: vetForAbsence.id,
            startDate: absence.startDate,
            endDate: absence.endDate,
            type: absence.type,
            note: absence.note ?? null,
          });
        })
      );

      // ────────────────────────────────────────────────────────────────────
      // CREATE OWNERS
      // ────────────────────────────────────────────────────────────────────
      const createdOwners = await Promise.all(
        TEST_DATA.owners.map((o) =>
          db
            .insert(owners)
            .values({
              tenantId: DEMO_TENANT_ID,
              ...o,
            })
            .returning()
            .then((r) => r[0])
        )
      );

      // ────────────────────────────────────────────────────────────────────
      // CREATE PATIENTS
      // ────────────────────────────────────────────────────────────────────
      const createdPatients = await Promise.all(
        TEST_DATA.patients.map(({ ownerIndex, ...patientData }) =>
          db
            .insert(patients)
            .values({
              tenantId: DEMO_TENANT_ID,
              ownerId: createdOwners[ownerIndex]!.id,
              ...patientData,
              birthDate: new Date(new Date().getFullYear() - 3, 0, 1),
              active: true,
            })
            .returning()
            .then((r) => r[0])
        )
      );

      // ────────────────────────────────────────────────────────────────────
      // CREATE DIAGNOSES
      // ────────────────────────────────────────────────────────────────────
      const createdDiagnoses = await Promise.all(
        TEST_DATA.diagnoses.map(({ patientIndex, ...diagnosisData }) =>
          db
            .insert(diagnoses)
            .values({
              tenantId: DEMO_TENANT_ID,
              vetId: vet.id,
              patientId: createdPatients[patientIndex]!.id,
              ...diagnosisData,
              dateOfDiagnosis: new Date(
                now.getTime() - 7 * 24 * 60 * 60 * 1000
              ),
            })
            .returning()
            .then((r) => r[0])
        )
      );

      // ────────────────────────────────────────────────────────────────────
      // CREATE MEDICATIONS
      // ────────────────────────────────────────────────────────────────────
      await Promise.all(
        TEST_DATA.medications.map(({ patientIndex, diagnosisIndex, ...medicationData }) =>
          db.insert(medications).values({
            tenantId: DEMO_TENANT_ID,
            prescribedBy: vet.id,
            patientId: createdPatients[patientIndex]!.id,
            diagnosisId:
              diagnosisIndex !== null
                ? createdDiagnoses[diagnosisIndex]!.id
                : undefined,
            ...medicationData,
            startDate: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
          })
        )
      );

      // ────────────────────────────────────────────────────────────────────
      // CREATE VITALS
      // ────────────────────────────────────────────────────────────────────
      await Promise.all(
        TEST_DATA.vitals.map(({ patientIndex, daysAgo, ...vitalData }) =>
          db.insert(vitals).values({
            tenantId: DEMO_TENANT_ID,
            recordedBy: vet.id,
            patientId: createdPatients[patientIndex]!.id,
            ...vitalData,
            recordedAt: new Date(
              now.getTime() - daysAgo * 24 * 60 * 60 * 1000
            ),
          })
        )
      );

      // ────────────────────────────────────────────────────────────────────
      // CREATE INTERNAL APPOINTMENTS
      // ────────────────────────────────────────────────────────────────────
      await Promise.all(
        TEST_DATA.internalAppointments.map(({ patientIndex, vetIndex, daysFromNow, hour, ...aptData }) => {
          const startTime = new Date(
            now.getTime() + daysFromNow * 24 * 60 * 60 * 1000
          );
          startTime.setHours(hour, 0, 0, 0);
          const endTime = new Date(startTime.getTime() + 30 * 60 * 1000);
          const appointmentVet = allVets[vetIndex];
          if (!appointmentVet) return null;

          return db.insert(appointments).values({
            tenantId: DEMO_TENANT_ID,
            patientId: createdPatients[patientIndex]!.id,
            vetId: appointmentVet.id,
            startTime,
            endTime,
            ...aptData,
            source: "manual",
          });
        })
      );

      // ────────────────────────────────────────────────────────────────────
      // CREATE ONLINE BOOKINGS
      // ────────────────────────────────────────────────────────────────────
      await Promise.all(
        TEST_DATA.onlineBookings.map(({ patientIndex, vetIndex, daysFromNow, hour, ...bookingData }) => {
          const startTime = new Date(
            now.getTime() + daysFromNow * 24 * 60 * 60 * 1000
          );
          startTime.setHours(hour, 0, 0, 0);
          const endTime = new Date(startTime.getTime() + 30 * 60 * 1000);
          const bookingVet = allVets[vetIndex];
          if (!bookingVet) return null;

          return db.insert(appointments).values({
            tenantId: DEMO_TENANT_ID,
            patientId: createdPatients[patientIndex]!.id,
            vetId: bookingVet.id,
            startTime,
            endTime,
            ...bookingData,
            source: "online_booking",
          });
        })
      );

      // ────────────────────────────────────────────────────────────────────
      // SUMMARY
      // ────────────────────────────────────────────────────────────────────
      const stats = getTestDataStats();
      const [persistedUsers] = await db
        .select({ count: sql`count(*)` })
        .from(users)
        .where(eq(users.tenantId, DEMO_TENANT_ID));
      const [persistedOwners] = await db
        .select({ count: sql`count(*)` })
        .from(owners)
        .where(eq(owners.tenantId, DEMO_TENANT_ID));
      const [persistedPatients] = await db
        .select({ count: sql`count(*)` })
        .from(patients)
        .where(eq(patients.tenantId, DEMO_TENANT_ID));
      const [persistedAppointments] = await db
        .select({ count: sql`count(*)` })
        .from(appointments)
        .where(eq(appointments.tenantId, DEMO_TENANT_ID));
      const [persistedSchedules] = await db
        .select({ count: sql`count(*)` })
        .from(vetSchedules)
        .where(eq(vetSchedules.tenantId, DEMO_TENANT_ID));
      const [persistedAbsences] = await db
        .select({ count: sql`count(*)` })
        .from(vetAbsences)
        .where(eq(vetAbsences.tenantId, DEMO_TENANT_ID));
      const [appointmentRange] = await db
        .select({
          minStart: sql`min(${appointments.startTime})`,
          maxStart: sql`max(${appointments.startTime})`,
        })
        .from(appointments)
        .where(eq(appointments.tenantId, DEMO_TENANT_ID));

      const persistedSummary = {
        users: Number(persistedUsers?.count ?? 0),
        owners: Number(persistedOwners?.count ?? 0),
        patients: Number(persistedPatients?.count ?? 0),
        appointments: Number(persistedAppointments?.count ?? 0),
        vetSchedules: Number(persistedSchedules?.count ?? 0),
        vetAbsences: Number(persistedAbsences?.count ?? 0),
      };

      if (
        persistedSummary.users === 0 ||
        persistedSummary.appointments === 0 ||
        persistedSummary.vetSchedules === 0
      ) {
        throw new Error(
          `Post-reset verification failed: ${JSON.stringify(persistedSummary)}`
        );
      }

      console.log(`✅ Reset complete!`);
      console.log(`📊 Deleted:`);
      console.log(`   - Users: ${usersCount.count || 0}`);
      console.log(`   - Vet absences: ${vetAbsencesCount.count || 0}`);
      console.log(`   - Vet schedules: ${vetSchedulesCount.count || 0}`);
      console.log(`   - Voice calls: ${voiceCallsCount.count || 0}`);
      console.log(`   - Medications: ${medicationsCount.count || 0}`);
      console.log(`   - Vitals: ${vitalsCount.count || 0}`);
      console.log(`   - Diagnoses: ${diagnosesCount.count || 0}`);
      console.log(`   - Appointments: ${appointmentsCount.count || 0}`);
      console.log(`   - Patients: ${patientsCount.count || 0}`);
      console.log(`   - Owners: ${ownersCount.count || 0}`);
      console.log(`   - Roles (with permissions): ${rolesCount.count || 0}`);
      console.log(`📊 Created test data:`);
      console.log(`   - Roles: Admin, Vet, Receptionist`);
      console.log(`   - Users: ${createdUsers.length} (${stats.vets} vets)`);
      console.log(`   - Vet schedules: ${stats.vetSchedules}`);
      console.log(`   - Vet absences: ${stats.vetAbsences}`);
      console.log(`   - Owners: ${stats.owners}`);
      console.log(`   - Patients: ${stats.patients}`);
      console.log(
        `   - Appointments: ${stats.internalAppointments} internal + ${stats.onlineBookings} bookings`
      );
      console.log(`   - Diagnoses: ${stats.diagnoses}`);
      console.log(`   - Medications: ${stats.medications}`);
      console.log(`   - Vitals: ${stats.vitals}`);
      console.log(`🔎 Persisted verification (demo tenant):`);
      console.log(`   - Users: ${persistedSummary.users}`);
      console.log(`   - Owners: ${persistedSummary.owners}`);
      console.log(`   - Patients: ${persistedSummary.patients}`);
      console.log(`   - Appointments: ${persistedSummary.appointments}`);
      console.log(`   - Vet schedules: ${persistedSummary.vetSchedules}`);
      console.log(`   - Vet absences: ${persistedSummary.vetAbsences}`);
      const formatIso = (value: unknown) => {
        if (!value) return "n/a";
        const d = value instanceof Date ? value : new Date(String(value));
        return Number.isNaN(d.getTime()) ? "n/a" : d.toISOString();
      };
      console.log(
        `   - Appointment range: ${formatIso(
          appointmentRange?.minStart
        )} -> ${formatIso(appointmentRange?.maxStart)}`
      );
    } else {
      console.log("Usage:");
      console.log(
        "  npx tsx scripts/admin-reset.ts --set-slug    # Set demo slug once"
      );
      console.log(
        "  npx tsx scripts/admin-reset.ts --reset       # Reset demo tenant (nightly)"
      );
      process.exit(1);
    }
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  } finally {
    await pg.end();
    process.exit(0);
  }
}

main();
