import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
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

      // Create rich appointment history
      const now = new Date();

      const appointmentsList = [
        // Historische abgeschlossene Termine (letzte Woche)
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
        // No-Show Beispiel
        {
          patientId: createdPatients[4].id,
          startTime: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000),
          title: "Untersuchung",
          status: "no-show" as const,
        },
        // Cancelled Beispiel
        {
          patientId: createdPatients[5].id,
          startTime: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
          title: "Gesundheitscheck",
          status: "cancelled" as const,
        },
        // Zukünftige geplante Termine
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

      // Insert all appointments
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
    // Check if endpoint is configured
    const expectedToken = process.env.ADMIN_API_TOKEN;
    if (!expectedToken) {
      return NextResponse.json(
        { error: "Admin API endpoint not configured" },
        { status: 503 }
      );
    }

    // Get token from Authorization header
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Missing or invalid Authorization header" },
        { status: 401 }
      );
    }

    const token = authHeader.slice(7); // Remove "Bearer " prefix

    // Use timing-safe comparison
    try {
      const match = timingSafeEqual(
        Buffer.from(token),
        Buffer.from(expectedToken)
      );
      if (!match) {
        return NextResponse.json(
          { error: "Unauthorized" },
          { status: 401 }
        );
      }
    } catch {
      // timingSafeEqual throws if lengths don't match
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const action = request.nextUrl.searchParams.get("action");

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
