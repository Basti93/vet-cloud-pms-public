/**
 * Seed-Script für Vet Cloud PMS
 * Erstellt Demo-Daten: 1 Tenant, 2 User, 5 Patienten, 10 Termine
 *
 * Ausführen: npm run db:seed
 * (oder: npx tsx scripts/seed.ts)
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
} from "../src/lib/db/schema";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error("DATABASE_URL not set — check .env.local");
}

const dbUrl = DATABASE_URL + (DATABASE_URL.includes("?") ? "&sslmode=require" : "?sslmode=require");
const sql = postgres(dbUrl, { max: 1 });
const db = drizzle(sql, { schema });

// ── Helper ────────────────────────────────────────────────────────────────────

function randomFutureDate(daysFromNow: number, hour: number) {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  d.setHours(hour, 0, 0, 0);
  return d;
}

// ── Seed ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log("🌱  Seeding Vet Cloud PMS…\n");

  // 1. Tenant
  console.log("📦  Tenant…");
  const [tenant] = await db
    .insert(tenants)
    .values({
      name: "Tierarztpraxis Musterstadt",
      slug: "musterstadt-vet",
      email: "praxis@musterstadt-vet.de",
      phone: "+49 800 123 456",
      address: "Musterstraße 42",
      city: "Musterstadt",
      postalCode: "12345",
      country: "DE",
      subscriptionStatus: "trial",
      subscriptionPlan: "starter",
    })
    .onConflictDoNothing()
    .returning();

  if (!tenant) {
    console.log("   → Tenant existiert bereits, überspringe…");
    await sql.end();
    return;
  }

  console.log(`   ✓ Tenant: ${tenant.name} (${tenant.id})`);

  // 2. Users (Staff)
  console.log("\n👩‍⚕️  Users…");
  const [vetUser] = await db
    .insert(users)
    .values([
      {
        tenantId: tenant.id,
        clerkId: "demo_vet_clerk_id",
        email: "dr.mueller@musterstadt-vet.de",
        firstName: "Dr. Anna",
        lastName: "Müller",
        role: "vet",
      },
      {
        tenantId: tenant.id,
        clerkId: "demo_reception_clerk_id",
        email: "empfang@musterstadt-vet.de",
        firstName: "Lisa",
        lastName: "Schmidt",
        role: "reception",
      },
    ])
    .returning();

  console.log(`   ✓ ${vetUser?.firstName} ${vetUser?.lastName}`);

  // 3. Owners + Patients
  console.log("\n🐾  Patienten & Halter…");

  const patientData = [
    {
      owner: { firstName: "Max", lastName: "Bauer", email: "m.bauer@example.de", phone: "0176 123 456" },
      patient: { name: "Bello", species: "Hund", breed: "Labrador Retriever", weight: 28000 },
    },
    {
      owner: { firstName: "Sarah", lastName: "Klein", email: "s.klein@example.de", phone: "0176 234 567" },
      patient: { name: "Miau", species: "Katze", breed: "Europäisch Kurzhaar", weight: 4500 },
    },
    {
      owner: { firstName: "Thomas", lastName: "Richter", email: "t.richter@example.de", phone: "0176 345 678" },
      patient: { name: "Rocky", species: "Hund", breed: "Border Collie", weight: 22000 },
    },
    {
      owner: { firstName: "Emma", lastName: "Weber", email: "e.weber@example.de", phone: "0176 456 789" },
      patient: { name: "Luna", species: "Katze", breed: "Siamkatze", weight: 3200 },
    },
    {
      owner: { firstName: "Jan", lastName: "Hoffmann", email: "j.hoffmann@example.de", phone: "0176 567 890" },
      patient: { name: "Tweety", species: "Vogel", breed: "Wellensittich", weight: 35 },
    },
  ];

  const createdPatients: (typeof patients.$inferSelect)[] = [];

  for (const data of patientData) {
    const [owner] = await db
      .insert(owners)
      .values({ tenantId: tenant.id, ...data.owner })
      .returning();

    const [patient] = await db
      .insert(patients)
      .values({
        tenantId: tenant.id,
        ownerId: owner!.id,
        ...data.patient,
        active: true,
      })
      .returning();

    createdPatients.push(patient!);
    console.log(`   ✓ ${patient?.name} (${patient?.species}) — Halter: ${owner?.firstName} ${owner?.lastName}`);
  }

  // 4. Appointments
  console.log("\n📅  Termine…");

  if (!vetUser) throw new Error("No vet user created");

  const appointmentTemplates = [
    { title: "Impfung Grundimmunisierung", daysFromNow: 1, hour: 9 },
    { title: "Jährliche Vorsorgeuntersuchung", daysFromNow: 1, hour: 10 },
    { title: "Zahnreinigung", daysFromNow: 2, hour: 9 },
    { title: "Kastrationsoperation", daysFromNow: 2, hour: 11 },
    { title: "Wundversorgung", daysFromNow: 3, hour: 14 },
    { title: "Blutuntersuchung", daysFromNow: 4, hour: 9 },
    { title: "Impfauffrischung", daysFromNow: 4, hour: 10 },
    { title: "Notfallkonsultation — Erbrechen", daysFromNow: 5, hour: 8 },
    { title: "Chip-Registrierung", daysFromNow: 6, hour: 15 },
    { title: "Routinekontrolle nach OP", daysFromNow: 7, hour: 11 },
  ];

  for (let i = 0; i < appointmentTemplates.length; i++) {
    const tmpl = appointmentTemplates[i]!;
    const patient = createdPatients[i % createdPatients.length]!;
    const startTime = randomFutureDate(tmpl.daysFromNow, tmpl.hour);
    const endTime = new Date(startTime.getTime() + 30 * 60_000); // +30 min

    const [appt] = await db
      .insert(appointments)
      .values({
        tenantId: tenant.id,
        patientId: patient.id,
        vetId: vetUser.id,
        startTime,
        endTime,
        title: tmpl.title,
        status: "scheduled",
        source: i % 4 === 0 ? "voice_ai" : "manual",
      })
      .returning();

    console.log(
      `   ✓ ${appt?.title} — ${patient.name} — ${startTime.toLocaleDateString("de-DE")} ${String(tmpl.hour).padStart(2, "0")}:00`
    );
  }

  console.log("\n✅  Seed abgeschlossen!");
  console.log(`\n   Tenant: ${tenant.name}`);
  console.log(`   Patienten: ${createdPatients.length}`);
  console.log(`   Termine: ${appointmentTemplates.length}`);

  await sql.end();
}

main().catch((err) => {
  console.error("❌ Seed fehlgeschlagen:", err);
  process.exit(1);
});
