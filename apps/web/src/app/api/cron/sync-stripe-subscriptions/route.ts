import { NextRequest, NextResponse } from "next/server";
import { db as appDb } from "@/lib/db/client";
import { tenants } from "@/lib/db/schema";
import { getStripeClient } from "@/lib/stripe/client";
import { isNotNull, eq } from "drizzle-orm";

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
    const stripe = getStripeClient();
    const now = new Date();

    // Find all tenants with stripeCustomerId
    const tenantsWithStripe = await appDb
      .select()
      .from(tenants)
      .where(isNotNull(tenants.stripeCustomerId));

    console.log(`[Stripe Sync] Found ${tenantsWithStripe.length} tenants with Stripe customer IDs`);

    let synced = 0;
    let errors = 0;
    const errorDetails: string[] = [];

    for (const tenant of tenantsWithStripe) {
      try {
        if (!tenant.stripeCustomerId) {
          continue;
        }

        // Verify customer still exists in Stripe (may be deleted)
        let customerDeleted = false;
        try {
          const customer = await stripe.customers.retrieve(tenant.stripeCustomerId);
          customerDeleted = (customer as { deleted?: boolean }).deleted === true;
        } catch (err) {
          const stripeErr = err as { code?: string };
          if (stripeErr.code === "resource_missing") {
            customerDeleted = true;
          } else {
            throw err; // re-throw unexpected errors
          }
        }

        if (customerDeleted) {
          console.log(`[Stripe Sync] Customer ${tenant.stripeCustomerId} deleted in Stripe — clearing IDs for tenant ${tenant.id}`);
          await appDb
            .update(tenants)
            .set({
              stripeCustomerId: null,
              stripeSubscriptionId: null,
              currentStripePriceId: null,
            })
            .where(eq(tenants.id, tenant.id));
          synced++;
          continue;
        }

        // Fetch subscriptions for this customer
        const subs = await stripe.subscriptions.list({
          customer: tenant.stripeCustomerId,
          limit: 10, // Most clinics won't have more than 10 subs
        });

        // Find active (not cancelled) subscription
        const activeSub = subs.data.find(
          (s) => s.status !== "canceled" && s.status !== "incomplete_expired"
        );

        const updateData: Record<string, any> = {};

        if (!activeSub && tenant.stripeSubscriptionId) {
          // No active subscription found but DB has one — deactivate
          if (!tenant.deactivatedAt) {
            updateData.deactivatedAt = now;
            updateData.subscriptionStatus = "cancelled";
          }
        } else if (activeSub) {
          // Active subscription found — sync from Stripe (source of truth)
          updateData.stripeSubscriptionId = activeSub.id;

          if (activeSub.items.data[0]?.price?.id) {
            updateData.currentStripePriceId = activeSub.items.data[0].price.id;
          }

          // Update trial status
          if (activeSub.trial_end && activeSub.trial_end * 1000 > Date.now()) {
            updateData.subscriptionStatus = "trial";
            updateData.trialEndsAt = new Date(activeSub.trial_end * 1000);
          } else if (activeSub.status === "active") {
            updateData.subscriptionStatus = "active";
          } else if (activeSub.status === "paused") {
            updateData.subscriptionStatus = "paused";
          }

          // Handle cancellation status
          if (activeSub.cancel_at_period_end) {
            updateData.cancelledAtPeriodEnd = new Date(activeSub.cancel_at! * 1000);
          } else {
            updateData.cancelledAtPeriodEnd = null;
          }
        }

        // Only update if there are changes
        if (Object.keys(updateData).length > 0) {
          await appDb
            .update(tenants)
            .set(updateData)
            .where(eq(tenants.id, tenant.id));
          synced++;
        }
      } catch (error) {
        errors++;
        const errorMsg = `Tenant ${tenant.id}: ${error instanceof Error ? error.message : String(error)}`;
        errorDetails.push(errorMsg);
        console.error(`[Stripe Sync] Error processing tenant ${tenant.id}:`, error);
      }
    }

    return NextResponse.json({
      success: true,
      totalTenants: tenantsWithStripe.length,
      synced,
      errors,
      timestamp: now.toISOString(),
      ...(errors > 0 && { errorDetails }),
    });
  } catch (error) {
    console.error("[Stripe Sync] Fatal error:", error);
    return NextResponse.json(
      {
        error: "Sync job failed",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
