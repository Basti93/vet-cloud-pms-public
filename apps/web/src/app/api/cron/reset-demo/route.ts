import { NextRequest, NextResponse } from "next/server";
import { adminDb as db } from "@/lib/db/client";
import {
  getDemoVetUsersFromTenant,
  resetDemoTenantData,
} from "@/lib/demo/reset-demo-tenant";

const CRON_SECRET = process.env.CRON_SECRET;

/**
 * Cron endpoint: reset and reseed demo tenant data.
 * Auth via Authorization: Bearer <CRON_SECRET>
 */
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!CRON_SECRET || authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const vetUsers = await getDemoVetUsersFromTenant(db);
    if (vetUsers.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error:
            "No demo vet users found. Run scripts/demo-reset.ts --reset once to bootstrap users/roles.",
        },
        { status: 409 }
      );
    }

    const summary = await resetDemoTenantData({
      db,
      vetUsers,
      now: new Date(),
    });

    return NextResponse.json({
      success: true,
      mode: "cron-data-only",
      message: "Demo tenant reset completed",
      ...summary,
    });
  } catch (error) {
    console.error("Demo cron reset failed:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to reset demo tenant",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

export const maxDuration = 120;
