import { createTRPCRouter, protectedProcedure } from "@/server/trpc";
import { z } from "zod";
import { tenants, PERMISSIONS } from "@/lib/db/schema";
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
import { requirePermission } from "@/server/trpc/middleware";

export const subscriptionsRouter = createTRPCRouter({
  createCheckoutSession: protectedProcedure
    .use(requirePermission(PERMISSIONS.SETTINGS_MANAGE))
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

        // Check if tenant has existing trial
        const domain = getMainDomain();
        let trialPeriodDays = TRIAL_DAYS;
        let metadataTrialDaysRemaining = undefined;

        if (
          tenantData.subscriptionStatus === "trial" &&
          tenantData.trialEndsAt &&
          new Date(tenantData.trialEndsAt) > new Date()
        ) {
          // Existing trial still active — calculate remaining days
          const remainingMs =
            new Date(tenantData.trialEndsAt).getTime() - Date.now();
          const remainingDays = Math.ceil(remainingMs / (1000 * 60 * 60 * 24));
          trialPeriodDays = Math.max(remainingDays, 0);
          metadataTrialDaysRemaining = remainingDays.toString();
        }

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
            trial_period_days: trialPeriodDays > 0 ? trialPeriodDays : undefined,
            metadata: {
              tenantId: tenantData.id,
              seats: seats.toString(),
              ...(metadataTrialDaysRemaining && {
                trialDaysRemaining: metadataTrialDaysRemaining,
              }),
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
        paymentFailureCount: tenantData.paymentFailureCount || 0,
        paymentGracePeriodEndsAt: tenantData.paymentGracePeriodEndsAt,
        trialDaysUsed: tenantData.trialDaysUsed || 0,
        originalTrialEndsAt: tenantData.originalTrialEndsAt,
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
    .use(requirePermission(PERMISSIONS.SETTINGS_MANAGE))
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

  undoCancellation: protectedProcedure
    .use(requirePermission(PERMISSIONS.SETTINGS_MANAGE))
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
          throw new TRPCError({ code: "NOT_FOUND", message: "Tenant not found" });
        }

        const tenantData = tenant[0];

        if (!tenantData.stripeSubscriptionId) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "No active subscription found",
          });
        }

        if (!tenantData.cancelledAtPeriodEnd) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Subscription is not scheduled for cancellation",
          });
        }

        const stripe = getStripeClient();

        await stripe.subscriptions.update(tenantData.stripeSubscriptionId, {
          cancel_at_period_end: false,
        });

        await appDb
          .update(tenants)
          .set({ cancelledAtPeriodEnd: null })
          .where(eq(tenants.id, tenantId));

        logEventAsync({
          level: "info",
          category: "subscription",
          eventType: "cancellation_undone",
          message: "Subscription cancellation undone by user",
          metadata: { tenantId, stripeSubscriptionId: tenantData.stripeSubscriptionId },
        });

        return { success: true, message: "Cancellation undone" };
      } catch (error) {
        logEventAsync({
          level: "error",
          category: "stripe",
          eventType: "undo_cancellation_failed",
          message: "Failed to undo subscription cancellation",
          metadata: { error: serializeLogError(error) },
        });
        throw error;
      }
    }),

  reactivateSubscription: protectedProcedure
    .use(requirePermission(PERMISSIONS.SETTINGS_MANAGE))
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

        // Reactivate tenant by clearing deactivation and payment grace period
        await appDb
          .update(tenants)
          .set({
            deactivatedAt: null,
            subscriptionStatus: "active",
            paymentFailureCount: 0,
            paymentGracePeriodEndsAt: null,
          })
          .where(eq(tenants.id, tenantId));

        logEventAsync({
          level: "info",
          category: "subscription",
          eventType: "subscription_reactivated",
          message: "Subscription reactivated by user",
          metadata: { tenantId },
        });

        return {
          success: true,
          message: "Subscription reactivated",
        };
      } catch (error) {
        logEventAsync({
          level: "error",
          category: "stripe",
          eventType: "reactivate_subscription_failed",
          message: "Failed to reactivate subscription",
          metadata: { error: serializeLogError(error) },
        });
        throw error;
      }
    }),

});
