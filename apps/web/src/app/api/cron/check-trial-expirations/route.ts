import { NextRequest, NextResponse } from "next/server";
import { adminDb as appDb } from "@/lib/db/client";
import { tenants, users } from "@/lib/db/schema";
import { sendTrialExpiredAdminEmail } from "@/lib/email/service";
import { isNull, lt, and, eq } from "drizzle-orm";
import { getMainDomain } from "@/lib/env";

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || !authHeader || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const now = new Date();

    // Find all tenants with trial status that expired
    const expiredTrials = await appDb
      .select()
      .from(tenants)
      .where(
        and(
          eq(tenants.subscriptionStatus, "trial"),
          lt(tenants.trialEndsAt, now),
          isNull(tenants.deactivatedAt)
        )
      );

    console.log(`[Trial Expiration Cron] Found ${expiredTrials.length} expired trials`);

    let processed = 0;
    let failed = 0;

    for (const tenant of expiredTrials) {
      try {
        // Deactivate tenant
        await appDb
          .update(tenants)
          .set({
            subscriptionStatus: "cancelled",
            deactivatedAt: now,
          })
          .where(eq(tenants.id, tenant.id));

        // Find all admin users for this tenant
        const admins = await appDb
          .select({ email: users.email })
          .from(users)
          .where(eq(users.tenantId, tenant.id));

        const adminEmails = admins
          .map((u) => u.email)
          .filter((e): e is string => !!e);

        if (adminEmails.length > 0) {
          const mainDomain = getMainDomain();
          const adminDashboardUrl = `${mainDomain}/admin app/${tenant.slug}/`;

          await sendTrialExpiredAdminEmail({
            clinicName: tenant.name,
            adminEmails,
            adminDashboardUrl,
          });
        }

        processed++;
        console.log(`[Trial Expiration Cron] Deactivated tenant: ${tenant.id}`);
      } catch (error) {
        failed++;
        console.error(`[Trial Expiration Cron] Error processing tenant ${tenant.id}:`, error);
      }
    }

    return NextResponse.json({
      success: true,
      totalExpired: expiredTrials.length,
      processed,
      failed,
      timestamp: now.toISOString(),
    });
  } catch (error) {
    console.error("[Trial Expiration Cron] Error:", error);
    return NextResponse.json(
      { error: "Cron job failed", details: String(error) },
      { status: 500 }
    );
  }
}
