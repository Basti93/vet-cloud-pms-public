import { NextRequest, NextResponse } from "next/server";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import {
  tenants,
  appointments,
  patients,
  owners,
  voiceCalls,
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
    schema: { tenants, appointments, patients, owners, voiceCalls },
  });

  try {
    // Delete voice calls
    const voiceCallsCount = await db
      .delete(voiceCalls)
      .where(eq(voiceCalls.tenantId, DEMO_TENANT_ID));

    // Delete appointments
    const appointmentsCount = await db
      .delete(appointments)
      .where(eq(appointments.tenantId, DEMO_TENANT_ID));

    // Delete patients
    const patientsCount = await db
      .delete(patients)
      .where(eq(patients.tenantId, DEMO_TENANT_ID));

    // Delete owners
    const ownersCount = await db
      .delete(owners)
      .where(eq(owners.tenantId, DEMO_TENANT_ID));

    await sql.end();

    return {
      success: true,
      stats: {
        voiceCallsDeleted: 0,
        appointmentsDeleted: 0,
        patientsDeleted: 0,
        ownersDeleted: 0,
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
