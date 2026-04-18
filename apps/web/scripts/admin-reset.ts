/**
 * Admin utilities: Reset demo tenant with fresh test data from test-data.ts
 *
 * Usage:
 *   - Set slug once: npx tsx scripts/admin-reset.ts --set-slug
 *   - Reset nightly: npx tsx scripts/admin-reset.ts --reset
 */

import fs from "fs";
import path from "path";

// Load .env.local manually
const envPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  envContent.split("\n").forEach((line) => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#")) {
      const [key, ...valueParts] = trimmed.split("=");
      if (key && valueParts.length > 0) {
        process.env[key.trim()] = valueParts.join("=").trim();
      }
    }
  });
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
  roles,
  rolePermissions,
} from "@/lib/db/schema";
import { eq, and, sql } from "drizzle-orm";
import {
  TEST_DATA,
  DEMO_TENANT_ID,
  DEMO_TENANT_SLUG,
  getTestDataStats,
} from "./test-data";
import { createDefaultRoles } from "@/lib/auth/permissions";

async function main() {
  const DATABASE_URL = process.env.DATABASE_URL;
  if (!DATABASE_URL) {
    console.error("❌ DATABASE_URL not set");
    process.exit(1);
  }

  const dbUrl =
    DATABASE_URL +
    (DATABASE_URL.includes("?") ? "&sslmode=require" : "?sslmode=require");
  const sql = postgres(dbUrl, { max: 1 });
  const db = drizzle(sql, {
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
      roles,
      rolePermissions,
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

      // Delete in correct order (foreign key constraints)
      // Role permissions will be cascade-deleted when roles are deleted
      const rolesCount = await db
        .delete(roles)
        .where(eq(roles.tenantId, DEMO_TENANT_ID));

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
      const createdUsers = await Promise.all(
        TEST_DATA.users.map((u) =>
          db
            .insert(users)
            .values({
              ...u,
              active: true,
            })
            .returning()
            .then((r) => r[0])
        )
      );

      // ────────────────────────────────────────────────────────────────────
      // ASSIGN ROLES TO USERS
      // ────────────────────────────────────────────────────────────────────
      console.log("🔐 Assigning roles to users...");
      const rolesByName = (await db.select().from(roles).where(eq(roles.tenantId, DEMO_TENANT_ID))).reduce(
        (acc, role) => {
          acc[role.name.toLowerCase()] = role.id;
          return acc;
        },
        {} as Record<string, string>
      );

      await Promise.all(
        createdUsers.map((u) => {
          if (!u) return Promise.resolve(null);
          const roleId = rolesByName[u.role.toLowerCase()];
          if (!roleId) return Promise.resolve(null);
          return db
            .update(users)
            .set({ roleId })
            .where(eq(users.id, u.id));
        })
      );
      console.log("  ✓ Roles assigned\n");

      const createdVets = createdUsers.filter((u) => u?.role === "vet");
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
            startHour: schedule.startHour,
            endHour: schedule.endHour,
            isWorkingDay: schedule.isWorkingDay,
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

      console.log(`✅ Reset complete!`);
      console.log(`📊 Deleted:`);
      console.log(`   - Users: ${usersCount.count || 0}`);
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
      console.log(`   - Owners: ${stats.owners}`);
      console.log(`   - Patients: ${stats.patients}`);
      console.log(
        `   - Appointments: ${stats.internalAppointments} internal + ${stats.onlineBookings} bookings`
      );
      console.log(`   - Diagnoses: ${stats.diagnoses}`);
      console.log(`   - Medications: ${stats.medications}`);
      console.log(`   - Vitals: ${stats.vitals}`);
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
    await sql.end();
  }
}

main();
