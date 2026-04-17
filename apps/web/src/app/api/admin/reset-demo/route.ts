import { NextRequest, NextResponse } from "next/server";
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

const DEMO_TENANT_ID = "00000000-0000-4000-8000-000000000003";
const DEMO_TENANT_SLUG = "demo";

/**
 * Protect with a simple secret token (use environment variable in production)
 * Usage: POST /api/admin/reset-demo?action=reset&token=YOUR_SECRET
 *        POST /api/admin/reset-demo?action=set-slug&token=YOUR_SECRET
 */
async function resetDemo() {
  const DATABASE_URL = process.env.DATABASE_URL;
  if (!DATABASE_URL) {
    throw new Error("DATABASE_URL not configured");
  }

  const dbUrl =
    DATABASE_URL +
    (DATABASE_URL.includes("?") ? "&sslmode=require" : "?sslmode=require");
  const sql = postgres(dbUrl, { max: 1 });
  const db = drizzle(sql, {
    schema: { tenants, appointments, patients, owners, voiceCalls, users },
  });

  try {
    // Delete voice calls
    await db.delete(voiceCalls).where(eq(voiceCalls.tenantId, DEMO_TENANT_ID));

    // Delete appointments
    await db
      .delete(appointments)
      .where(eq(appointments.tenantId, DEMO_TENANT_ID));

    // Delete patients
    await db.delete(patients).where(eq(patients.tenantId, DEMO_TENANT_ID));

    // Delete owners
    await db.delete(owners).where(eq(owners.tenantId, DEMO_TENANT_ID));

    // ✅ Create sample test data
    // Get first active vet for this tenant
    const [vet] = await db
      .select({ id: users.id })
      .from(users)
      .where(
        eq(users.tenantId, DEMO_TENANT_ID)
      )
      .limit(1);

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
          weight: 32000, // 32kg in grams
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
          weight: 4500, // 4.5kg
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
    }

    await sql.end();

    return {
      success: true,
      message: "Demo tenant reset and seeded with test data",
      stats: {
        ownersCreated: 2,
        patientsCreated: 3,
        appointmentsCreated: 2,
      },
    };
  } catch (error) {
    await sql.end();
    throw error;
  }
}

async function setSlug() {
  const DATABASE_URL = process.env.DATABASE_URL;
  if (!DATABASE_URL) {
    throw new Error("DATABASE_URL not configured");
  }

  const dbUrl =
    DATABASE_URL +
    (DATABASE_URL.includes("?") ? "&sslmode=require" : "?sslmode=require");
  const sql = postgres(dbUrl, { max: 1 });
  const db = drizzle(sql, { schema: { tenants } });

  try {
    const [tenant] = await db
      .update(tenants)
      .set({ slug: DEMO_TENANT_SLUG })
      .where(eq(tenants.id, DEMO_TENANT_ID))
      .returning();

    await sql.end();

    if (!tenant) {
      throw new Error("Demo tenant not found");
    }

    return { success: true, slug: tenant.slug };
  } catch (error) {
    await sql.end();
    throw error;
  }
}

export async function POST(request: NextRequest) {
  try {
    // Validate token
    const token = request.nextUrl.searchParams.get("token");
    const action = request.nextUrl.searchParams.get("action");
    const expectedToken = process.env.ADMIN_API_TOKEN;

    if (!token || !expectedToken || token !== expectedToken) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    if (action === "reset") {
      const result = await resetDemo();
      return NextResponse.json(result);
    } else if (action === "set-slug") {
      const result = await setSlug();
      return NextResponse.json(result);
    } else {
      return NextResponse.json(
        { error: "Invalid action. Use 'reset' or 'set-slug'" },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error("❌ Admin API error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
