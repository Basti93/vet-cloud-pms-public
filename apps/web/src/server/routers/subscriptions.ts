import { createTRPCRouter, protectedProcedure } from "@/server/trpc";
import { z } from "zod";
import { tenants } from "@/lib/db/schema";
import { db as appDb } from "@/lib/db/client";
import { eq } from "drizzle-orm";
import { getStripeClient } from "@/lib/stripe/client";
import {
  TRIAL_DAYS,
  getPriceBySeats,
  getPriceById,
} from "@/lib/stripe/prices";
import { TRPCError } from "@trpc/server";
import { getMainDomain } from "@/lib/env";
import { logEventAsync, serializeLogError } from "@/server/trpc/logging-middleware";

export const subscriptionsRouter = createTRPCRouter({
  createCheckoutSession: protectedProcedure
    .input(
      z.object({
        seats: z.number().int().min(1).max(10),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const tenantId = (ctx as any).tenantId;
        const { seats } = input;

        // Get tenant
        const tenant = await appDb
          .select()
          .from(tenants)
          .where(eq(tenants.id, tenantId))
          .limit(1);

        if (!tenant.length) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Tenant not found",
          });
        }

        const tenantData = tenant[0];
        const stripe = getStripeClient();
        const price = getPriceBySeats(seats);

        // Get or create Stripe customer
        let stripeCustomerId = tenantData.stripeCustomerId;

        if (!stripeCustomerId) {
          const customer = await stripe.customers.create({
            email: tenantData.email,
            name: tenantData.name,
            metadata: {
              tenantId: tenantData.id,
            },
          });
          stripeCustomerId = customer.id;

          // Update tenant with Stripe customer ID
          await appDb
            .update(tenants)
            .set({ stripeCustomerId: customer.id })
            .where(eq(tenants.id, tenantId));
        }

        // Create checkout session with trial
        const domain = getMainDomain();
        const session = await stripe.checkout.sessions.create({
          customer: stripeCustomerId,
          mode: "subscription",
          line_items: [
            {
              price: price.priceId,
              quantity: 1,
            },
          ],
          subscription_data: {
            trial_period_days: TRIAL_DAYS,
            metadata: {
              tenantId: tenantData.id,
              seats: seats.toString(),
            },
          },
          success_url: `${domain}/dashboard/settings/account?status=success`,
          cancel_url: `${domain}/dashboard/settings/account?status=cancel`,
        });

        return {
          sessionId: session.id,
          url: session.url,
        };
      } catch (error) {
        logEventAsync({
          level: "error",
          category: "stripe",
          eventType: "checkout_session_failed",
          message: "Failed to create checkout session",
          metadata: { error: serializeLogError(error) },
        });
        throw error;
      }
    }),

  getSubscriptionStatus: protectedProcedure
    .input(z.object({}).optional())
    .query(async ({ ctx }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tenantId = (ctx as any).tenantId;

      if (!tenantId) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "No tenant context",
        });
      }

      const tenant = await appDb
        .select()
        .from(tenants)
        .where(eq(tenants.id, tenantId))
        .limit(1);

      if (!tenant.length) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Tenant not found",
        });
      }

      const tenantData = tenant[0];

      return {
        status: tenantData.subscriptionStatus,
        plan: tenantData.subscriptionPlan,
        maxUsers: tenantData.maxUsers,
        currentPrice: tenantData.currentStripePriceId
          ? getPriceById(tenantData.currentStripePriceId)
          : null,
        trialEndsAt: tenantData.trialEndsAt,
        deactivatedAt: tenantData.deactivatedAt,
        lastPaymentFailedAt: tenantData.lastPaymentFailedAt,
        cancelledAtPeriodEnd: tenantData.cancelledAtPeriodEnd,
        isTrialing:
          tenantData.subscriptionStatus === "trial" &&
          tenantData.trialEndsAt &&
          new Date(tenantData.trialEndsAt) > new Date(),
        daysUntilTrialEnds: tenantData.trialEndsAt
          ? Math.ceil(
              (new Date(tenantData.trialEndsAt).getTime() - Date.now()) /
                (1000 * 60 * 60 * 24)
            )
          : null,
      };
    }),

  cancelSubscription: protectedProcedure
    .input(z.object({}).optional())
    .mutation(async ({ ctx }) => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const tenantId = (ctx as any).tenantId;

        const tenant = await appDb
          .select()
          .from(tenants)
          .where(eq(tenants.id, tenantId))
          .limit(1);

        if (!tenant.length) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Tenant not found",
          });
        }

        const tenantData = tenant[0];

        if (!tenantData.stripeSubscriptionId) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "No active subscription found",
          });
        }

        const stripe = getStripeClient();

        const subscription = await stripe.subscriptions.update(
          tenantData.stripeSubscriptionId,
          { cancel_at_period_end: true }
        );

        // Update DB with cancellation timestamp
        await appDb
          .update(tenants)
          .set({ cancelledAtPeriodEnd: new Date(subscription.cancel_at! * 1000) })
          .where(eq(tenants.id, tenantId));

        logEventAsync({
          level: "info",
          category: "subscription",
          eventType: "subscription_cancelled",
          message: "Subscription cancelled by user",
          metadata: {
            tenantId,
            stripeSubscriptionId: tenantData.stripeSubscriptionId,
            cancelAt: new Date(subscription.cancel_at! * 1000),
          },
        });

        return {
          success: true,
          message: "Subscription cancelled",
          cancellationDate: new Date(subscription.cancel_at! * 1000),
        };
      } catch (error) {
        logEventAsync({
          level: "error",
          category: "stripe",
          eventType: "cancel_subscription_failed",
          message: "Failed to cancel subscription",
          metadata: { error: serializeLogError(error) },
        });
        throw error;
      }
    }),

});
