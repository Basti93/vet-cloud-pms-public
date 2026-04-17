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
import * as schema from "../src/lib/db/schema";
import {
  tenants,
  users,
  owners,
  patients,
  appointments,
  diagnoses,
  medications,
  vitals,
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
const db = drizzle(sql, { schema });

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
    // 2. CREATE USERS
    // ────────────────────────────────────────────────────────────────────────
    console.log("👤 Creating users...");
    const createdUsers = await Promise.all(
      TEST_DATA.users.map((u) =>
        db
          .insert(users)
          .values({
            tenantId,
            ...u,
            active: true,
          })
          .onConflictDoNothing()
          .returning()
          .then((r) => r[0])
      )
    );

    const vetUser = createdUsers.find((u) => u?.role === "vet");
    if (!vetUser) throw new Error("No vet user created");
    console.log(`  ✓ ${createdUsers.length} users\n`);

    // ────────────────────────────────────────────────────────────────────────
    // 3. CREATE OWNERS
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
      TEST_DATA.patients.map((p) =>
        db
          .insert(patients)
          .values({
            tenantId,
            ownerId: createdOwners[p.ownerIndex]!.id,
            ...p,
            ownerIndex: undefined,
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
      TEST_DATA.diagnoses.map((d) =>
        db
          .insert(diagnoses)
          .values({
            tenantId,
            vetId: vetUser.id,
            patientId: createdPatients[d.patientIndex]!.id,
            ...d,
            patientIndex: undefined,
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
      TEST_DATA.medications.map((m) =>
        db
          .insert(medications)
          .values({
            tenantId,
            prescribedBy: vetUser.id,
            patientId: createdPatients[m.patientIndex]!.id,
            diagnosisId: m.diagnosisIndex !== null
              ? createdDiagnoses[m.diagnosisIndex]!.id
              : undefined,
            ...m,
            patientIndex: undefined,
            diagnosisIndex: undefined,
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
      TEST_DATA.vitals.map((v) =>
        db
          .insert(vitals)
          .values({
            tenantId,
            recordedBy: vetUser.id,
            patientId: createdPatients[v.patientIndex]!.id,
            ...v,
            patientIndex: undefined,
            daysAgo: undefined,
            recordedAt: new Date(Date.now() - v.daysAgo * 24 * 60 * 60 * 1000),
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
      TEST_DATA.internalAppointments.map((apt) => {
        const startTime = new Date(
          now.getTime() + apt.daysFromNow * 24 * 60 * 60 * 1000
        );
        startTime.setHours(apt.hour, 0, 0, 0);
        const endTime = new Date(startTime.getTime() + 30 * 60 * 1000);

        return db.insert(appointments).values({
          tenantId,
          patientId: createdPatients[apt.patientIndex]!.id,
          vetId: vetUser.id,
          startTime,
          endTime,
          title: apt.title,
          description: apt.description,
          status: apt.status,
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
      TEST_DATA.onlineBookings.map((booking) => {
        const startTime = new Date(
          now.getTime() + booking.daysFromNow * 24 * 60 * 60 * 1000
        );
        startTime.setHours(booking.hour, 0, 0, 0);
        const endTime = new Date(startTime.getTime() + 30 * 60 * 1000);

        return db.insert(appointments).values({
          tenantId,
          patientId: createdPatients[booking.patientIndex]!.id,
          vetId: vetUser.id,
          startTime,
          endTime,
          title: booking.title,
          status: booking.status,
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
    console.log(`  • Users: ${stats.owners}`);
    console.log(`  • Owners: ${stats.owners}`);
    console.log(`  • Patients: ${stats.patients}`);
    console.log(`  • Diagnoses: ${stats.diagnoses}`);
    console.log(`  • Medications: ${stats.medications}`);
    console.log(`  • Vitals: ${stats.vitals}`);
    console.log(
      `  • Appointments: ${stats.internalAppointments} internal + ${stats.onlineBookings} bookings`
    );

    await sql.end();
  } catch (error) {
    console.error("❌ Seed failed:", error);
    await sql.end();
    process.exit(1);
  }
}

seed();
