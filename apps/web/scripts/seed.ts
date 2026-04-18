/**
 * Database Seed Script für vet-cloud-pms
 *
 * Erstellt Demo-Daten aus test-data.ts
 * Usage: npm run db:seed
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
import { eq } from "drizzle-orm";
import {
  tenants,
  users,
  owners,
  patients,
  appointments,
  diagnoses,
  medications,
  vitals,
  vetSchedules,
} from "../src/lib/db/schema";
import { TEST_DATA, DEMO_TENANT_ID, getTestDataStats } from "./test-data";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error("DATABASE_URL not set — check .env.local");
}

const dbUrl =
  DATABASE_URL +
  (DATABASE_URL.includes("?") ? "&sslmode=require" : "?sslmode=require");
const sql = postgres(dbUrl, { max: 1 });
const db = drizzle(sql, {
  schema: {
    tenants,
    users,
    owners,
    patients,
    appointments,
    diagnoses,
    medications,
    vitals,
  },
});

async function seed() {
  try {
    console.log("🌱 Starting seed from test-data.ts...\n");

    // ────────────────────────────────────────────────────────────────────────
    // 1. CREATE TENANT
    // ────────────────────────────────────────────────────────────────────────
    console.log("📍 Creating tenant...");
    const [tenant] = await db
      .insert(tenants)
      .values(TEST_DATA.tenant)
      .onConflictDoNothing()
      .returning();

    const tenantId = tenant?.id || DEMO_TENANT_ID;
    console.log(`  ✓ ${TEST_DATA.tenant.name}\n`);

    // ────────────────────────────────────────────────────────────────────────
    // CLEANUP (remove old test data to prevent duplicates on re-runs)
    // ────────────────────────────────────────────────────────────────────────
    console.log("🗑️  Cleaning up old test data...");
    await db.delete(appointments).where(eq(appointments.tenantId, tenantId));
    await db.delete(diagnoses).where(eq(diagnoses.tenantId, tenantId));
    await db.delete(medications).where(eq(medications.tenantId, tenantId));
    await db.delete(vitals).where(eq(vitals.tenantId, tenantId));
    await db.delete(patients).where(eq(patients.tenantId, tenantId));
    await db.delete(owners).where(eq(owners.tenantId, tenantId));
    console.log("  ✓ Old data removed\n");

    // ────────────────────────────────────────────────────────────────────────
    // 2. CREATE USERS
    // ────────────────────────────────────────────────────────────────────────
    console.log("👤 Creating users...");
    const createdUsers = await Promise.all(
      TEST_DATA.users.map((u) =>
        db
          .insert(users)
          .values({
            ...u,
            active: true,
          })
          .onConflictDoNothing()
          .returning()
          .then((r) => r[0])
      )
    );

    // If users already existed, fetch them from DB
    const createdOrExistingUsers = await Promise.all(
      createdUsers.map((u, i) => {
        if (u) return Promise.resolve(u);
        // User wasn't created (onConflictDoNothing), fetch from DB
        return db
          .select()
          .from(users)
          .where(eq(users.clerkId, TEST_DATA.users[i].clerkId))
          .limit(1)
          .then((r) => r[0]);
      })
    );

    const createdVets = createdOrExistingUsers.filter((u) => u?.role === "vet");
    if (createdVets.length === 0) throw new Error("No vet users created");
    const vetUser = createdVets[0]!; // Use first vet as default
    console.log(`  ✓ ${createdUsers.length} users\n`);

    // ────────────────────────────────────────────────────────────────────────
    // 2b. CREATE VET SCHEDULES
    // ────────────────────────────────────────────────────────────────────────
    console.log("📅 Creating vet schedules...");
    const createdSchedules = await Promise.all(
      TEST_DATA.vetSchedules.map((schedule) => {
        const vet = createdVets[schedule.vetIndex];
        if (!vet) return null;
        return db
          .insert(vetSchedules)
          .values({
            tenantId,
            vetId: vet.id,
            dayOfWeek: schedule.dayOfWeek,
            startHour: schedule.startHour,
            endHour: schedule.endHour,
            isWorkingDay: schedule.isWorkingDay,
          })
          .returning()
          .then((r) => r[0]);
      })
    );
    console.log(`  ✓ ${createdSchedules.filter(Boolean).length} vet schedules\n`);

    // ────────────────────────────────────────────────────────────────────────
    // 3. CREATE OWNERS
    // (skipping 2c on purpose - schedules are in 2b)
    // ────────────────────────────────────────────────────────────────────────
    console.log("👨‍👩‍👧 Creating owners...");
    const createdOwners = await Promise.all(
      TEST_DATA.owners.map((o) =>
        db
          .insert(owners)
          .values({
            tenantId,
            ...o,
          })
          .returning()
          .then((r) => r[0])
      )
    );
    console.log(`  ✓ ${createdOwners.length} owners\n`);

    // ────────────────────────────────────────────────────────────────────────
    // 4. CREATE PATIENTS
    // ────────────────────────────────────────────────────────────────────────
    console.log("🐕 Creating patients...");
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
          .then((r) => r[0])
      )
    );
    console.log(`  ✓ ${createdPatients.length} patients\n`);

    // ────────────────────────────────────────────────────────────────────────
    // 5. CREATE DIAGNOSES
    // ────────────────────────────────────────────────────────────────────────
    console.log("🩺 Creating diagnoses...");
    const createdDiagnoses = await Promise.all(
      TEST_DATA.diagnoses.map(({ patientIndex, ...diagnosisData }) =>
        db
          .insert(diagnoses)
          .values({
            tenantId,
            vetId: vetUser.id,
            patientId: createdPatients[patientIndex]!.id,
            ...diagnosisData,
            dateOfDiagnosis: new Date(
              Date.now() - 7 * 24 * 60 * 60 * 1000
            ),
          })
          .returning()
          .then((r) => r[0])
      )
    );
    console.log(`  ✓ ${createdDiagnoses.length} diagnoses\n`);

    // ────────────────────────────────────────────────────────────────────────
    // 6. CREATE MEDICATIONS
    // ────────────────────────────────────────────────────────────────────────
    console.log("💊 Creating medications...");
    await Promise.all(
      TEST_DATA.medications.map(({ patientIndex, diagnosisIndex, ...medicationData }) =>
        db
          .insert(medications)
          .values({
            tenantId,
            prescribedBy: vetUser.id,
            patientId: createdPatients[patientIndex]!.id,
            diagnosisId: diagnosisIndex !== null
              ? createdDiagnoses[diagnosisIndex]!.id
              : undefined,
            ...medicationData,
            startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          })
      )
    );
    console.log(`  ✓ ${TEST_DATA.medications.length} medications\n`);

    // ────────────────────────────────────────────────────────────────────────
    // 7. CREATE VITALS
    // ────────────────────────────────────────────────────────────────────────
    console.log("📊 Creating vitals...");
    await Promise.all(
      TEST_DATA.vitals.map(({ patientIndex, daysAgo, ...vitalData }) =>
        db
          .insert(vitals)
          .values({
            tenantId,
            recordedBy: vetUser.id,
            patientId: createdPatients[patientIndex]!.id,
            ...vitalData,
            recordedAt: new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000),
          })
      )
    );
    console.log(`  ✓ ${TEST_DATA.vitals.length} vitals\n`);

    // ────────────────────────────────────────────────────────────────────────
    // 8. CREATE INTERNAL APPOINTMENTS
    // ────────────────────────────────────────────────────────────────────────
    console.log("📅 Creating internal appointments...");
    const now = new Date();
    await Promise.all(
      TEST_DATA.internalAppointments.map(({ patientIndex, vetIndex, daysFromNow, hour, ...aptData }) => {
        const startTime = new Date(
          now.getTime() + daysFromNow * 24 * 60 * 60 * 1000
        );
        startTime.setHours(hour, 0, 0, 0);
        const endTime = new Date(startTime.getTime() + 30 * 60 * 1000);
        const appointmentVet = createdVets[vetIndex];
        if (!appointmentVet) return null;

        return db.insert(appointments).values({
          tenantId,
          patientId: createdPatients[patientIndex]!.id,
          vetId: appointmentVet.id,
          startTime,
          endTime,
          ...aptData,
          source: "manual",
        });
      })
    );
    console.log(`  ✓ ${TEST_DATA.internalAppointments.length} internal appointments\n`);

    // ────────────────────────────────────────────────────────────────────────
    // 9. CREATE ONLINE BOOKINGS
    // ────────────────────────────────────────────────────────────────────────
    console.log("📅 Creating online bookings...");
    await Promise.all(
      TEST_DATA.onlineBookings.map(({ patientIndex, vetIndex, daysFromNow, hour, ...bookingData }) => {
        const startTime = new Date(
          now.getTime() + daysFromNow * 24 * 60 * 60 * 1000
        );
        startTime.setHours(hour, 0, 0, 0);
        const endTime = new Date(startTime.getTime() + 30 * 60 * 1000);
        const bookingVet = createdVets[vetIndex];
        if (!bookingVet) return null;

        return db.insert(appointments).values({
          tenantId,
          patientId: createdPatients[patientIndex]!.id,
          vetId: bookingVet.id,
          startTime,
          endTime,
          ...bookingData,
          source: "online_booking",
        });
      })
    );
    console.log(`  ✓ ${TEST_DATA.onlineBookings.length} online bookings\n`);

    // ────────────────────────────────────────────────────────────────────────
    // SUMMARY
    // ────────────────────────────────────────────────────────────────────────
    const stats = getTestDataStats();
    console.log("✨ Seed completed successfully!\n");
    console.log("📊 Summary:");
    console.log(`  • Tenant: ${TEST_DATA.tenant.name}`);
    console.log(`  • Users: ${createdUsers.length} (${stats.vets} vets)`);
    console.log(`  • Vet schedules: ${stats.vetSchedules}`);
    console.log(`  • Owners: ${stats.owners}`);
    console.log(`  • Patients: ${stats.patients}`);
    console.log(`  • Diagnoses: ${stats.diagnoses}`);
    console.log(`  • Medications: ${stats.medications}`);
    console.log(`  • Vitals: ${stats.vitals}`);
    console.log(
      `  • Appointments: ${stats.internalAppointments} internal + ${stats.onlineBookings} bookings`
    );
  } catch (error) {
    console.error("❌ Seed failed:", error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

seed();
