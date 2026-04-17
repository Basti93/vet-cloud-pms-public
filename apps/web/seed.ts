/**
 * Database Seed Script für vet-cloud-pms
 *
 * Erstellt Demo-Daten für Tests und Entwicklung:
 * - 1 Demo Tenant ("demo")
 * - 1 Admin User pro Tenant
 * - 3 Test Owners mit Patienten
 * - Medical Records (Diagnosen, Medikamente, Vitals)
 * - Appointments (manual + online_booking)
 *
 * Usage:
 *   npx tsx seed.ts
 */

import { db } from "@/lib/db";
import {
  tenants,
  users,
  owners,
  patients,
  appointments,
  diagnoses,
  medications,
  vitals,
} from "@/lib/db/schema";

const DEMO_TENANT_ID = "00000000-0000-4000-8000-000000000003";

async function seed() {
  try {
    console.log("🌱 Starting seed...\n");

    // ────────────────────────────────────────────────────────────────────────
    // 1. CREATE TENANT
    // ────────────────────────────────────────────────────────────────────────
    console.log("📍 Creating demo tenant...");
    const [tenant] = await db
      .insert(tenants)
      .values({
        id: DEMO_TENANT_ID,
        name: "Demo Praxis",
        slug: "demo",
        email: "demo@example.com",
        phone: "+49 123 456789",
        address: "Musterstraße 1",
        city: "Musterstadt",
        postalCode: "12345",
        country: "DE",
        subscriptionStatus: "trial",
        subscriptionPlan: "starter",
        maxUsers: 5,
      })
      .onConflictDoNothing()
      .returning();

    const tenantId = tenant?.id || DEMO_TENANT_ID;
    console.log(`  ✓ Tenant: ${tenantId}\n`);

    // ────────────────────────────────────────────────────────────────────────
    // 2. CREATE ADMIN USER
    // ────────────────────────────────────────────────────────────────────────
    console.log("👤 Creating admin user...");
    const [adminUser] = await db
      .insert(users)
      .values({
        tenantId,
        clerkId: "user_demo_admin_001",
        email: "admin@demo.example.com",
        firstName: "Dr.",
        lastName: "Admin",
        role: "admin",
        active: true,
      })
      .onConflictDoNothing()
      .returning();

    const vetId = adminUser?.id || (await getOrCreateVet(tenantId));
    console.log(`  ✓ Admin User: ${vetId}\n`);

    // ────────────────────────────────────────────────────────────────────────
    // 3. CREATE OWNERS
    // ────────────────────────────────────────────────────────────────────────
    console.log("👨‍👩‍👧 Creating owners...");
    const ownerData = [
      {
        firstName: "Max",
        lastName: "Mustermann",
        email: "max@example.com",
        phone: "+49 123 111111",
        city: "Berlin",
      },
      {
        firstName: "Erika",
        lastName: "Beispiel",
        email: "erika@example.com",
        phone: "+49 123 222222",
        city: "Musterstadt",
      },
      {
        firstName: "Thomas",
        lastName: "Test",
        email: "thomas@example.com",
        phone: "+49 123 333333",
        city: "Hamburg",
      },
    ];

    const insertedOwners = await db
      .insert(owners)
      .values(
        ownerData.map((o) => ({
          tenantId,
          ...o,
          address: "Beispielstraße 1",
          postalCode: "10115",
          country: "DE",
        }))
      )
      .returning();

    console.log(`  ✓ Created ${insertedOwners.length} owners\n`);

    // ────────────────────────────────────────────────────────────────────────
    // 4. CREATE PATIENTS
    // ────────────────────────────────────────────────────────────────────────
    console.log("🐕 Creating patients...");
    const patientsData = [
      {
        ownerId: insertedOwners[0].id,
        name: "Bella",
        species: "Hund",
        breed: "Golden Retriever",
        color: "Gold",
        weight: 32000, // 32kg in gramm
      },
      {
        ownerId: insertedOwners[0].id,
        name: "Milo",
        species: "Katze",
        breed: "Britisch Kurzhaar",
        color: "Grau",
        weight: 4500, // 4.5kg
      },
      {
        ownerId: insertedOwners[1].id,
        name: "Luna",
        species: "Hund",
        breed: "Husky",
        color: "Weiß/Grau",
        weight: 28000,
      },
      {
        ownerId: insertedOwners[2].id,
        name: "Whiskers",
        species: "Kaninchen",
        breed: "Widder",
        color: "Braun",
        weight: 2000, // 2kg
      },
    ];

    const insertedPatients = await db
      .insert(patients)
      .values(
        patientsData.map((p) => ({
          tenantId,
          ...p,
          birthDate: new Date(new Date().getFullYear() - 3, 0, 1),
          active: true,
        }))
      )
      .returning();

    console.log(`  ✓ Created ${insertedPatients.length} patients\n`);

    // ────────────────────────────────────────────────────────────────────────
    // 5. CREATE MEDICAL RECORDS (DIAGNOSES)
    // ────────────────────────────────────────────────────────────────────────
    console.log("🩺 Creating diagnoses...");
    const diagnosesData = [
      {
        patientId: insertedPatients[0].id, // Bella
        title: "Otitis Externa",
        description: "Entzündung des äußeren Gehörgangs",
        severity: "mild",
        status: "active",
        dateOfDiagnosis: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 Tage ago
      },
      {
        patientId: insertedPatients[1].id, // Milo
        title: "Zahnstein",
        description: "Moderate Zahnsteinbildung, Zahnreinigung empfohlen",
        severity: "moderate",
        status: "monitoring",
        dateOfDiagnosis: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 Tage ago
      },
      {
        patientId: insertedPatients[2].id, // Luna
        title: "Allergische Dermatitis",
        description: "Hautallergien, wahrscheinlich Futterallergie",
        severity: "moderate",
        status: "active",
        dateOfDiagnosis: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
      },
    ];

    const insertedDiagnoses = await db
      .insert(diagnoses)
      .values(
        diagnosesData.map((d) => ({
          tenantId,
          vetId,
          ...d,
        }))
      )
      .returning();

    console.log(`  ✓ Created ${insertedDiagnoses.length} diagnoses\n`);

    // ────────────────────────────────────────────────────────────────────────
    // 6. CREATE MEDICATIONS
    // ────────────────────────────────────────────────────────────────────────
    console.log("💊 Creating medications...");
    const medicationsData = [
      {
        patientId: insertedPatients[0].id, // Bella
        diagnosisId: insertedDiagnoses[0].id,
        medicationName: "Ofloxacin Ohrentropfen",
        dosage: "3 Tropfen",
        frequency: "2x täglich",
        route: "ophthalmic",
        startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        notes: "Vor Anwendung erwärmen",
      },
      {
        patientId: insertedPatients[1].id, // Milo
        medicationName: "Hill's t/d Zahnpflegefutter",
        dosage: "120g",
        frequency: "1x täglich",
        route: "oral",
        startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        notes: "Zahnreinigung fördernd",
      },
      {
        patientId: insertedPatients[2].id, // Luna
        diagnosisId: insertedDiagnoses[2].id,
        medicationName: "Apoquel",
        dosage: "16mg",
        frequency: "1x täglich",
        route: "oral",
        startDate: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
        notes: "Bei Juckreiz",
      },
    ];

    const insertedMeds = await db
      .insert(medications)
      .values(
        medicationsData.map((m) => ({
          tenantId,
          prescribedBy: vetId,
          ...m,
        }))
      )
      .returning();

    console.log(`  ✓ Created ${insertedMeds.length} medications\n`);

    // ────────────────────────────────────────────────────────────────────────
    // 7. CREATE VITALS
    // ────────────────────────────────────────────────────────────────────────
    console.log("📊 Creating vitals...");
    const vitalsData = [
      {
        patientId: insertedPatients[0].id, // Bella
        weight: 32000,
        temperature: "38.5°C",
        heartRate: 85,
        respiratoryRate: 22,
        recordedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        notes: "Normal",
      },
      {
        patientId: insertedPatients[1].id, // Milo
        weight: 4500,
        temperature: "38.2°C",
        heartRate: 120,
        respiratoryRate: 28,
        recordedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        notes: "Katze ruhig",
      },
      {
        patientId: insertedPatients[2].id, // Luna
        weight: 28000,
        temperature: "38.7°C",
        heartRate: 90,
        respiratoryRate: 24,
        recordedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
        notes: "Leicht nervös, aber stabil",
      },
    ];

    const insertedVitals = await db
      .insert(vitals)
      .values(
        vitalsData.map((v) => ({
          tenantId,
          recordedBy: vetId,
          ...v,
        }))
      )
      .returning();

    console.log(`  ✓ Created ${insertedVitals.length} vital records\n`);

    // ────────────────────────────────────────────────────────────────────────
    // 8. CREATE APPOINTMENTS (INTERNAL + BOOKINGS)
    // ────────────────────────────────────────────────────────────────────────
    console.log("📅 Creating appointments...");
    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const appointmentsData = [
      // Manual internal appointments
      {
        patientId: insertedPatients[0].id, // Bella
        startTime: new Date(tomorrow.getTime() + 9 * 60 * 60 * 1000), // Tomorrow 9:00
        endTime: new Date(tomorrow.getTime() + 9.5 * 60 * 60 * 1000), // Tomorrow 9:30
        title: "Ohrenbehandlung",
        description: "Nachkontrolle Otitis",
        source: "manual",
        status: "scheduled",
      },
      {
        patientId: insertedPatients[1].id, // Milo
        startTime: new Date(tomorrow.getTime() + 10 * 60 * 60 * 1000), // Tomorrow 10:00
        endTime: new Date(tomorrow.getTime() + 10.5 * 60 * 60 * 1000),
        title: "Routineuntersuchung",
        source: "manual",
        status: "scheduled",
      },
      // Online booking requests
      {
        patientId: insertedPatients[2].id, // Luna (existing patient, re-booking)
        startTime: new Date(nextWeek.getTime() + 14 * 60 * 60 * 1000), // Next week 14:00
        endTime: new Date(nextWeek.getTime() + 14.5 * 60 * 60 * 1000),
        title: "Allergie-Kontrolle",
        source: "online_booking",
        status: "scheduled",
      },
      // Online booking for new patient
      {
        patientId: insertedPatients[3].id, // Whiskers
        startTime: new Date(nextWeek.getTime() + 15 * 60 * 60 * 1000),
        endTime: new Date(nextWeek.getTime() + 15.5 * 60 * 60 * 1000),
        title: "Erste Untersuchung",
        source: "online_booking",
        status: "scheduled",
      },
    ];

    const insertedAppointments = await db
      .insert(appointments)
      .values(
        appointmentsData.map((a) => ({
          tenantId,
          vetId,
          ...a,
        }))
      )
      .returning();

    console.log(`  ✓ Created ${insertedAppointments.length} appointments\n`);

    console.log("✨ Seed completed successfully!\n");
    console.log("📊 Summary:");
    console.log(`  • Tenant: ${tenantId}`);
    console.log(`  • Users: 1 admin`);
    console.log(`  • Owners: ${insertedOwners.length}`);
    console.log(`  • Patients: ${insertedPatients.length}`);
    console.log(`  • Diagnoses: ${insertedDiagnoses.length}`);
    console.log(`  • Medications: ${insertedMeds.length}`);
    console.log(`  • Vitals: ${insertedVitals.length}`);
    console.log(
      `  • Appointments: ${insertedAppointments.length} (${insertedAppointments.filter((a) => a.source === "online_booking").length} bookings)`
    );
  } catch (error) {
    console.error("❌ Seed failed:", error);
    process.exit(1);
  }
}

async function getOrCreateVet(tenantId: string) {
  const [existingVet] = await db
    .select({ id: users.id })
    .from(users)
    .where(
      (col) => col.tenantId === tenantId && col.active === true
    )
    .limit(1);

  if (existingVet) return existingVet.id;

  const [newVet] = await db
    .insert(users)
    .values({
      tenantId,
      clerkId: `user_demo_vet_${Date.now()}`,
      email: `vet${Date.now()}@demo.example.com`,
      firstName: "Dr. Tierarzt",
      lastName: "Demo",
      role: "vet",
      active: true,
    })
    .returning();

  return newVet.id;
}

// Run seed
seed().catch(console.error);
