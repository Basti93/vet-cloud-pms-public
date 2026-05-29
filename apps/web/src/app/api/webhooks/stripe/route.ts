import { NextRequest, NextResponse } from "next/server";
import { getStripeClient } from "@/lib/stripe/client";
import { db as appDb } from "@/lib/db/client";
import { tenants } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { sendTrialEndingEmail, sendPaymentFailedAdminEmail } from "@/lib/email/service";
import { TRIAL_DAYS, getTierByPriceId, getAddonByPriceId, type TierName, type BillingInterval } from "@/lib/stripe/prices";
import Stripe from "stripe";
import { trackServerEvent } from "@/lib/analytics/tracker-server";

/** Extracts tier + billing interval + website builder state from subscription items. */
async function syncSubscriptionItems(subscription: Stripe.Subscription): Promise<{
  subscriptionPlan?: TierName;
  maxUsers?: number;
  billingInterval?: BillingInterval;
  hasWebsiteBuilder?: boolean;
  websiteBuilderPriceId?: string | null;
}> {
  const result: {
    subscriptionPlan?: TierName;
    maxUsers?: number;
    billingInterval?: BillingInterval;
    hasWebsiteBuilder?: boolean;
    websiteBuilderPriceId?: string | null;
  } = {};

  let hasWb = false;
  let wbPriceId: string | null = null;

  for (const item of subscription.items.data) {
    const priceId = item.price.id;
    const [tier, addon] = await Promise.all([
      getTierByPriceId(priceId),
      getAddonByPriceId(priceId),
    ]);

    if (tier) {
      result.subscriptionPlan = tier.tier;
      result.maxUsers = tier.seats;
      result.billingInterval = tier.interval;
    }

    if (addon?.addon === "website-builder") {
      hasWb = true;
      wbPriceId = priceId;
    }
  }

  result.hasWebsiteBuilder = hasWb;
  result.websiteBuilderPriceId = wbPriceId;

  return result;
}

export async function POST(request: NextRequest) {
  const sig = request.headers.get("stripe-signature");

  if (!sig) {
    return NextResponse.json(
      { error: "Missing stripe-signature header" },
      { status: 400 }
    );
  }

  const body = await request.text();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error("STRIPE_WEBHOOK_SECRET not set");
    return NextResponse.json(
      { error: "Webhook secret not configured" },
      { status: 500 }
    );
  }

  let event;

  try {
    const stripe = getStripeClient();
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (error) {
    console.error("Webhook signature verification failed:", error);
    return NextResponse.json(
      { error: "Invalid signature" },
      { status: 400 }
    );
  }

  try {
    console.log(`[Stripe Webhook] Processing event type: ${event.type}`);

    switch (event.type) {
      case "customer.subscription.trial_will_end": {
        const subscription = event.data.object as Stripe.Subscription;
        const tenantId = subscription.metadata?.tenantId;

        if (tenantId) {
          const tenant = await appDb
            .select()
            .from(tenants)
            .where(eq(tenants.id, tenantId))
            .limit(1);

          if (tenant.length && tenant[0].email && tenant[0].slug) {
            await sendTrialEndingEmail({
              clinicName: tenant[0].name,
              clinicEmail: tenant[0].email,
              billingUrl: `/dashboard/${tenant[0].slug}/billing`,
            });
          }
        }
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const tenantId = (subscription.metadata as any)?.tenantId;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const trialDaysRemaining = (subscription.metadata as any)?.trialDaysRemaining;

        console.log(`[Stripe Webhook] subscription.updated - tenantId: ${tenantId}, subId: ${subscription.id}`);

        if (!tenantId) {
          console.warn(`[Stripe Webhook] subscription.updated missing tenantId in metadata`, subscription.metadata);
          break;
        }

        const tierPriceItem = subscription.items.data.find(
          (item) => !(item.price as { metadata?: Record<string, string> }).metadata?.addon
        );
        const priceId = tierPriceItem?.price?.id ?? null;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const updateData: Record<string, any> = {
          stripeSubscriptionId: subscription.id,
        };

        if (priceId) updateData.currentStripePriceId = priceId;

        // Sync tier name, seats, and billing interval from Stripe price metadata
        const itemSync = await syncSubscriptionItems(subscription);
        Object.assign(updateData, itemSync);

        // Handle cancellation status
        if (subscription.cancel_at_period_end) {
          updateData.cancelledAtPeriodEnd = new Date(subscription.cancel_at! * 1000);
        } else {
          updateData.cancelledAtPeriodEnd = null;
        }

        // Handle trial day preservation on mid-trial upgrade
        if (trialDaysRemaining && subscription.trial_end) {
          const remainingDays = parseInt(trialDaysRemaining, 10);
          updateData.trialEndsAt = new Date(subscription.trial_end * 1000);
          updateData.trialDaysUsed = Math.max(0, TRIAL_DAYS - remainingDays);
          updateData.originalTrialEndsAt = new Date(subscription.trial_end * 1000);
        }

        // Determine subscription status
        if (subscription.trial_end && subscription.trial_end * 1000 > Date.now()) {
          updateData.subscriptionStatus = "trial";
          updateData.trialEndsAt = new Date(subscription.trial_end * 1000);
        } else if (subscription.status === "active") {
          updateData.subscriptionStatus = "active";
        } else if (subscription.status === "paused") {
          updateData.subscriptionStatus = "paused";
        }

        await appDb
          .update(tenants)
          .set(updateData)
          .where(eq(tenants.id, tenantId));

        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const tenantId = subscription.metadata?.tenantId;

        if (tenantId) {
          await appDb
            .update(tenants)
            .set({
              subscriptionStatus: "cancelled",
              deactivatedAt: new Date(),
            })
            .where(eq(tenants.id, tenantId));
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer;

        if (typeof customerId === "string") {
          const tenant = await appDb
            .select()
            .from(tenants)
            .where(eq(tenants.stripeCustomerId, customerId))
            .limit(1);

          if (tenant.length) {
            const currentFailureCount = tenant[0].paymentFailureCount || 0;
            const newFailureCount = currentFailureCount + 1;
            const now = new Date();
            const gracePeriodEndsAt = new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000); // 10 days

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const updateData: Record<string, any> = {
              lastPaymentFailedAt: now,
              paymentFailureCount: newFailureCount,
            };

            // First failure: set grace period
            if (newFailureCount === 1) {
              updateData.paymentGracePeriodEndsAt = gracePeriodEndsAt;
            }

            // 3+ failures and grace period expired: deactivate
            if (newFailureCount >= 3 && tenant[0].paymentGracePeriodEndsAt && tenant[0].paymentGracePeriodEndsAt < now) {
              updateData.subscriptionStatus = "suspended";
              updateData.deactivatedAt = now;
            }

            await appDb
              .update(tenants)
              .set(updateData)
              .where(eq(tenants.id, tenant[0].id));

            // Send admin notification
            if (tenant[0].email) {
              const admins = await appDb
                .select({ email: (await import("@/lib/db/schema")).users.email })
                .from((await import("@/lib/db/schema")).users)
                .where(eq((await import("@/lib/db/schema")).users.tenantId, tenant[0].id));

              const adminEmails = admins
                .map((u) => u.email)
                .filter((e): e is string => !!e);

              if (adminEmails.length > 0) {
                await sendPaymentFailedAdminEmail({
                  clinicName: tenant[0].name,
                  adminEmails,
                  gracePeriodEndsAt,
                });
              }
            }
          }
        }
        break;
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer;

        if (typeof customerId === "string") {
          const tenant = await appDb
            .select()
            .from(tenants)
            .where(eq(tenants.stripeCustomerId, customerId))
            .limit(1);

          if (tenant.length) {
            // Reset payment failure counters on successful payment
            await appDb
              .update(tenants)
              .set({
                subscriptionStatus: "active",
                deactivatedAt: null,
                paymentFailureCount: 0,
                paymentGracePeriodEndsAt: null,
              })
              .where(eq(tenants.id, tenant[0].id));
          }
        }
        break;
      }

      case "customer.subscription.created": {
        const subscription = event.data.object as Stripe.Subscription;
        const tenantId = subscription.metadata?.tenantId;

        if (!tenantId) {
          console.warn(`[Stripe Webhook] subscription.created missing tenantId in metadata`);
          break;
        }

        const tierPriceItemCreated = subscription.items.data.find(
          (item) => !(item.price as { metadata?: Record<string, string> }).metadata?.addon
        );
        const createdPriceId = tierPriceItemCreated?.price?.id ?? null;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const createData: Record<string, any> = {
          stripeSubscriptionId: subscription.id,
        };

        if (createdPriceId) createData.currentStripePriceId = createdPriceId;

        const createdItemSync = await syncSubscriptionItems(subscription);
        Object.assign(createData, createdItemSync);

        if (subscription.trial_end && subscription.trial_end * 1000 > Date.now()) {
          createData.subscriptionStatus = "trial";
          createData.trialEndsAt = new Date(subscription.trial_end * 1000);
        } else if (subscription.status === "active") {
          createData.subscriptionStatus = "active";
        }

        await appDb
          .update(tenants)
          .set(createData)
          .where(eq(tenants.id, tenantId));

        console.log(`[Stripe Webhook] subscription.created — tenant ${tenantId} linked to subscription ${subscription.id}`);
        break;
      }

      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const customerId = session.customer;
        const subscriptionId = session.subscription;

        if (typeof customerId === "string" && typeof subscriptionId === "string") {
          const tenant = await appDb
            .select()
            .from(tenants)
            .where(eq(tenants.stripeCustomerId, customerId))
            .limit(1);

          if (tenant.length) {
            const stripe = getStripeClient();
            const subscription = await stripe.subscriptions.retrieve(subscriptionId);

            const tierItemCompleted = subscription.items.data.find(
              (item) => !(item.price as { metadata?: Record<string, string> }).metadata?.addon
            );
            const completedPriceId = tierItemCompleted?.price?.id ?? null;

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const updateData: Record<string, any> = {
              stripeSubscriptionId: subscriptionId,
            };

            if (completedPriceId) updateData.currentStripePriceId = completedPriceId;

            const completedItemSync = await syncSubscriptionItems(subscription);
            Object.assign(updateData, completedItemSync);

            if (subscription.trial_end && subscription.trial_end * 1000 > Date.now()) {
              updateData.subscriptionStatus = "trial";
              updateData.trialEndsAt = new Date(subscription.trial_end * 1000);
            } else if (subscription.status === "active") {
              updateData.subscriptionStatus = "active";
            }

            await appDb
              .update(tenants)
              .set(updateData)
              .where(eq(tenants.id, tenant[0].id));

            console.log(`[Stripe Webhook] checkout.session.completed — tenant ${tenant[0].id} linked to subscription ${subscriptionId}, price ${completedPriceId}`);
            await trackServerEvent("subscription_activated", {
              tier: String(completedItemSync.subscriptionPlan ?? "unknown"),
              billing_interval: String(completedItemSync.billingInterval ?? "unknown"),
            });
          }
        }
        break;
      }

      case "customer.deleted": {
        // Stripe prevents deleting customers with active subscriptions,
        // so customer.subscription.deleted always fires first.
        // Only clear Stripe IDs — don't touch subscriptionStatus (already cancelled).
        const customer = event.data.object as Stripe.Customer;

        await appDb
          .update(tenants)
          .set({
            stripeCustomerId: null,
            stripeSubscriptionId: null,
            currentStripePriceId: null,
          })
          .where(eq(tenants.stripeCustomerId, customer.id));

        console.log(`[Stripe Webhook] customer.deleted — cleared Stripe IDs for customer ${customer.id}`);
        break;
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Webhook handler error:", error);
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 }
    );
  }
}
