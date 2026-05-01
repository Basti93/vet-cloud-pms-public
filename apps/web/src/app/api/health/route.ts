import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";

/**
 * GET /api/health
 *
 * Health check endpoint for monitoring tools (Vercel, Sentry, etc.)
 * Returns the status of the application and database connectivity.
 *
 * Response: { status: "ok", db: "ok", timestamp: ISO8601 }
 */
export async function GET() {
  try {
    // Check database connectivity with a simple query
    const result = await db.execute("SELECT 1");

    if (!result) {
      return NextResponse.json(
        {
          status: "degraded",
          db: "error",
          timestamp: new Date().toISOString(),
          error: "Database query failed",
        },
        { status: 503 }
      );
    }

    return NextResponse.json({
      status: "ok",
      db: "ok",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Health check failed:", error);
    return NextResponse.json(
      {
        status: "error",
        db: "error",
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 503 }
    );
  }
}
