/**
 * Admin utilities: Set demo slug + reset demo tenant
 * Usage:
 *   - Set slug once: npx tsx scripts/admin-reset.ts --set-slug
 *   - Reset nightly: npx tsx scripts/admin-reset.ts --reset
 */

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import {
  tenants,
  appointments,
  patients,
  owners,
  voiceCalls,
  users,
} from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import * as fs from "fs";
import * as path from "path";

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

const DEMO_TENANT_ID = "00000000-0000-4000-8000-000000000003";
const DEMO_TENANT_SLUG = "demo";

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
  const db = drizzle(sql, { schema: { tenants, appointments, patients, owners, voiceCalls } });

  const command = process.argv[2];

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

      console.log(`✅ Success!`);
      console.log(`📌 Booking URL: /book/${DEMO_TENANT_SLUG}`);
    } else if (command === "--reset") {
      console.log(`🔄 Resetting demo tenant data...`);

      const voiceCallsCount = await db
        .delete(voiceCalls)
        .where(eq(voiceCalls.tenantId, DEMO_TENANT_ID));

      const appointmentsCount = await db
        .delete(appointments)
        .where(eq(appointments.tenantId, DEMO_TENANT_ID));

      const patientsCount = await db
        .delete(patients)
        .where(eq(patients.tenantId, DEMO_TENANT_ID));

      const ownersCount = await db
        .delete(owners)
        .where(eq(owners.tenantId, DEMO_TENANT_ID));

      // Create sample test data
      const [vet] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.tenantId, DEMO_TENANT_ID))
        .limit(1);

      let testDataStats = { owners: 0, patients: 0, appointments: 0 };

      if (vet) {
        // Create sample owners
        const [owner1] = await db
          .insert(owners)
          .values({
            tenantId: DEMO_TENANT_ID,
            firstName: "Max",
            lastName: "Müller",
            email: "max.mueller@example.de",
            phone: "+49123456789",
            address: "Hauptstraße 42",
            city: "Berlin",
            postalCode: "10115",
            country: "DE",
          })
          .returning();

        const [owner2] = await db
          .insert(owners)
          .values({
            tenantId: DEMO_TENANT_ID,
            firstName: "Sarah",
            lastName: "Schmidt",
            email: "sarah.schmidt@example.de",
            phone: "+49987654321",
            address: "Blumenweg 15",
            city: "Musterstadt",
            postalCode: "80331",
            country: "DE",
          })
          .returning();

        testDataStats.owners = 2;

        // Create sample patients
        const [patient1] = await db
          .insert(patients)
          .values({
            tenantId: DEMO_TENANT_ID,
            ownerId: owner1.id,
            name: "Bella",
            species: "Hund",
            breed: "Labrador Retriever",
            color: "Golden",
            weight: 32000,
          })
          .returning();

        const [patient2] = await db
          .insert(patients)
          .values({
            tenantId: DEMO_TENANT_ID,
            ownerId: owner1.id,
            name: "Mittens",
            species: "Katze",
            breed: "Britisch Kurzhaar",
            color: "Grau",
            weight: 4500,
          })
          .returning();

        const [patient3] = await db
          .insert(patients)
          .values({
            tenantId: DEMO_TENANT_ID,
            ownerId: owner2.id,
            name: "Luna",
            species: "Hund",
            breed: "Golden Retriever",
            color: "Creme",
            weight: 28000,
          })
          .returning();

        testDataStats.patients = 3;

        // Create sample appointments
        const now = new Date();
        const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        tomorrow.setHours(10, 0, 0, 0);

        const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        nextWeek.setHours(14, 0, 0, 0);

        await db.insert(appointments).values({
          tenantId: DEMO_TENANT_ID,
          patientId: patient1.id,
          vetId: vet.id,
          startTime: tomorrow,
          endTime: new Date(tomorrow.getTime() + 30 * 60 * 1000),
          title: "Routineuntersuchung",
          description: "Jährliche Kontrolluntersuchung",
          status: "scheduled",
          source: "manual",
        });

        await db.insert(appointments).values({
          tenantId: DEMO_TENANT_ID,
          patientId: patient2.id,
          vetId: vet.id,
          startTime: nextWeek,
          endTime: new Date(nextWeek.getTime() + 30 * 60 * 1000),
          title: "Zahnreinigung",
          status: "scheduled",
          source: "manual",
        });

        testDataStats.appointments = 2;
      }

      console.log(`✅ Reset complete!`);
      console.log(`📊 Deleted:`);
      console.log(`   - Voice calls: ${voiceCallsCount.count || 0}`);
      console.log(`   - Appointments: ${appointmentsCount.count || 0}`);
      console.log(`   - Patients: ${patientsCount.count || 0}`);
      console.log(`   - Owners: ${ownersCount.count || 0}`);
      console.log(`📊 Created test data:`);
      console.log(`   - Owners: ${testDataStats.owners}`);
      console.log(`   - Patients: ${testDataStats.patients}`);
      console.log(`   - Appointments: ${testDataStats.appointments}`);
    } else {
      console.log("Usage:");
      console.log("  npx tsx scripts/admin-reset.ts --set-slug    # Set demo slug once");
      console.log("  npx tsx scripts/admin-reset.ts --reset       # Reset demo tenant (nightly)");
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
