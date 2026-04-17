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
        // Create multiple sample owners
        const ownersList = [
          {
            firstName: "Max",
            lastName: "Müller",
            email: "max.mueller@example.de",
            phone: "+49123456789",
            address: "Hauptstraße 42",
            city: "Berlin",
            postalCode: "10115",
          },
          {
            firstName: "Sarah",
            lastName: "Schmidt",
            email: "sarah.schmidt@example.de",
            phone: "+49987654321",
            address: "Blumenweg 15",
            city: "Musterstadt",
            postalCode: "80331",
          },
          {
            firstName: "Thomas",
            lastName: "Weber",
            email: "thomas.weber@example.de",
            phone: "+49555123456",
            address: "Gartenstraße 8",
            city: "Hamburg",
            postalCode: "20095",
          },
          {
            firstName: "Julia",
            lastName: "Fischer",
            email: "julia.fischer@example.de",
            phone: "+49666789012",
            address: "Waldweg 23",
            city: "Köln",
            postalCode: "50667",
          },
        ];

        const createdOwners = await Promise.all(
          ownersList.map((o) =>
            db
              .insert(owners)
              .values({
                tenantId: DEMO_TENANT_ID,
                ...o,
                country: "DE",
              })
              .returning()
              .then((r) => r[0])
          )
        );

        testDataStats.owners = createdOwners.length;

        // Create multiple patients
        const patientsList = [
          {
            ownerId: createdOwners[0].id,
            name: "Bella",
            species: "Hund",
            breed: "Labrador Retriever",
            color: "Golden",
            weight: 32000,
          },
          {
            ownerId: createdOwners[0].id,
            name: "Mittens",
            species: "Katze",
            breed: "Britisch Kurzhaar",
            color: "Grau",
            weight: 4500,
          },
          {
            ownerId: createdOwners[1].id,
            name: "Luna",
            species: "Hund",
            breed: "Golden Retriever",
            color: "Creme",
            weight: 28000,
          },
          {
            ownerId: createdOwners[1].id,
            name: "Whiskers",
            species: "Katze",
            breed: "Perser",
            color: "Weiß",
            weight: 5200,
          },
          {
            ownerId: createdOwners[2].id,
            name: "Rex",
            species: "Hund",
            breed: "Deutscher Schäferhund",
            color: "Braun-Schwarz",
            weight: 38000,
          },
          {
            ownerId: createdOwners[3].id,
            name: "Tweety",
            species: "Vogel",
            breed: "Wellensittich",
            color: "Blau",
            weight: 35,
          },
        ];

        const createdPatients = await Promise.all(
          patientsList.map((p) =>
            db
              .insert(patients)
              .values({
                tenantId: DEMO_TENANT_ID,
                ...p,
              })
              .returning()
              .then((r) => r[0])
          )
        );

        testDataStats.patients = createdPatients.length;

        // Create rich appointment history
        const now = new Date();

        const appointmentsList = [
          // Historische abgeschlossene Termine
          {
            patientId: createdPatients[0].id,
            startTime: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
            title: "Routineuntersuchung",
            status: "completed" as const,
          },
          {
            patientId: createdPatients[1].id,
            startTime: new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000),
            title: "Zahnreinigung",
            status: "completed" as const,
          },
          {
            patientId: createdPatients[2].id,
            startTime: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000),
            title: "Impfung (Tollwut)",
            status: "completed" as const,
          },
          {
            patientId: createdPatients[3].id,
            startTime: new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000),
            title: "Parasitenkontrolle",
            status: "completed" as const,
          },
          // No-Show
          {
            patientId: createdPatients[4].id,
            startTime: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000),
            title: "Untersuchung",
            status: "no-show" as const,
          },
          // Cancelled
          {
            patientId: createdPatients[5].id,
            startTime: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
            title: "Gesundheitscheck",
            status: "cancelled" as const,
          },
          // Zukünftige
          {
            patientId: createdPatients[0].id,
            startTime: new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000),
            title: "Nachuntersuchung",
            status: "scheduled" as const,
          },
          {
            patientId: createdPatients[2].id,
            startTime: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000),
            title: "Impfauffrischung",
            status: "scheduled" as const,
          },
          {
            patientId: createdPatients[1].id,
            startTime: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
            title: "Routine Checkup",
            status: "scheduled" as const,
          },
        ];

        for (const apt of appointmentsList) {
          const endTime = new Date(apt.startTime.getTime() + 30 * 60 * 1000);
          await db.insert(appointments).values({
            tenantId: DEMO_TENANT_ID,
            patientId: apt.patientId,
            vetId: vet.id,
            startTime: apt.startTime,
            endTime,
            title: apt.title,
            description: `Demo appointment: ${apt.title}`,
            status: apt.status,
            source: "manual",
          });
        }

        testDataStats.appointments = appointmentsList.length;
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
