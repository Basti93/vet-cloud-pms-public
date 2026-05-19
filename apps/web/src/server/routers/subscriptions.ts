import { createTRPCRouter, protectedProcedure } from "@/server/trpc";
import { z } from "zod";
import { tenants, users, userRoles, roles, PERMISSIONS } from "@/lib/db/schema";
import { db as appDb } from "@/lib/db/client";
import { eq, and, count, inArray } from "drizzle-orm";
import { getStripeClient } from "@/lib/stripe/client";
import {
  TRIAL_DAYS,
  TIER_ORDER,
  getPriceByTier,
  getTierByPriceId,
  getWebsiteBuilderPrice,
  type TierName,
  type BillingInterval,
} from "@/lib/stripe/prices";
import { TRPCError } from "@trpc/server";
import { getMainDomain } from "@/lib/env";
import { logEventAsync, serializeLogError } from "@/server/trpc/logging-middleware";
import { ROLE_CODES } from "@/lib/auth/roles";
import { requirePermission } from "@/server/trpc/middleware";

const tierSchema = z.enum(["solo", "praxis", "klinik"]);
const intervalSchema = z.enum(["monthly", "annual"]).default("monthly");

export const subscriptionsRouter = createTRPCRouter({
  createCheckoutSession: protectedProcedure
    .use(requirePermission(PERMISSIONS.SETTINGS_MANAGE))
    .input(
      z.object({
        tier: tierSchema,
        billingInterval: intervalSchema,
        couponId: z.string().optional(),
        includeWebsiteBuilder: z.boolean().default(false),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const tenantId = (ctx as any).tenantId;
        const { tier, billingInterval, couponId, includeWebsiteBuilder } = input;

        const tenant = await appDb
          .select()
          .from(tenants)
          .where(eq(tenants.id, tenantId))
          .limit(1);

        if (!tenant.length) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Tenant not found" });
        }

        const tenantData = tenant[0];
        const stripe = getStripeClient();
        const price = await getPriceByTier(tier, billingInterval);

        let stripeCustomerId = tenantData.stripeCustomerId;

        if (!stripeCustomerId) {
          const customer = await stripe.customers.create({
            email: tenantData.email,
            name: tenantData.name,
            metadata: { tenantId: tenantData.id },
          });
          stripeCustomerId = customer.id;

          await appDb
            .update(tenants)
            .set({ stripeCustomerId: customer.id })
            .where(eq(tenants.id, tenantId));
        }

        const domain = getMainDomain();
        let trialPeriodDays = TRIAL_DAYS;
        let metadataTrialDaysRemaining: string | undefined;

        if (
          tenantData.subscriptionStatus === "trial" &&
          tenantData.trialEndsAt &&
          new Date(tenantData.trialEndsAt) > new Date()
        ) {
          const remainingMs = new Date(tenantData.trialEndsAt).getTime() - Date.now();
          const remainingDays = Math.ceil(remainingMs / (1000 * 60 * 60 * 24));
          trialPeriodDays = Math.max(remainingDays, 0);
          metadataTrialDaysRemaining = remainingDays.toString();
        }

        const lineItems: { price: string; quantity: number }[] = [
          { price: price.priceId, quantity: 1 },
        ];

        if (includeWebsiteBuilder) {
          const wbPrice = await getWebsiteBuilderPrice(billingInterval);
          lineItems.push({ price: wbPrice.priceId, quantity: 1 });
        }

        const session = await stripe.checkout.sessions.create({
          customer: stripeCustomerId,
          mode: "subscription",
          line_items: lineItems,
          ...(couponId ? { discounts: [{ coupon: couponId }] } : {}),
          subscription_data: {
            trial_period_days: trialPeriodDays > 0 ? trialPeriodDays : undefined,
            metadata: {
              tenantId: tenantData.id,
              tier,
              seats: price.seats.toString(),
              billing_interval: billingInterval,
              ...(metadataTrialDaysRemaining && { trialDaysRemaining: metadataTrialDaysRemaining }),
            },
          },
          success_url: `${domain}/dashboard/settings/account?status=success`,
          cancel_url: `${domain}/dashboard/settings/account?status=cancel`,
        });

        return { sessionId: session.id, url: session.url };
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

  changePlan: protectedProcedure
    .use(requirePermission(PERMISSIONS.SETTINGS_MANAGE))
    .input(
      z.object({
        tier: tierSchema,
        billingInterval: intervalSchema,
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const tenantId = (ctx as any).tenantId;
        const { tier, billingInterval } = input;

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
            message: "No active subscription to change. Use createCheckoutSession instead.",
          });
        }

        const newPrice = await getPriceByTier(tier, billingInterval);

        if (tenantData.currentStripePriceId === newPrice.priceId) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Already on this plan" });
        }

        const currentTier = await getTierByPriceId(tenantData.currentStripePriceId ?? "");
        const currentTierIndex = currentTier ? TIER_ORDER.indexOf(currentTier.tier) : -1;
        const newTierIndex = TIER_ORDER.indexOf(tier);
        const isUpgrade = newTierIndex > currentTierIndex ||
          (newTierIndex === currentTierIndex && currentTier?.interval === "monthly" && billingInterval === "annual");

        const stripe = getStripeClient();
        const subscription = await stripe.subscriptions.retrieve(tenantData.stripeSubscriptionId);

        // Find the main tier item (not Website Builder)
        const tierItem = subscription.items.data.find((item) => {
          const meta = (item.price as { metadata?: Record<string, string> }).metadata;
          return !meta?.addon;
        });

        if (!tierItem) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Subscription has no tier item" });
        }

        const isOnTrial = subscription.status === "trialing";
        const prorationType = isOnTrial ? "none" : isUpgrade ? "create_prorations" : "none";

        await stripe.subscriptions.update(tenantData.stripeSubscriptionId, {
          items: [{ id: tierItem.id, price: newPrice.priceId }],
          proration_behavior: prorationType,
          metadata: { tenantId, tier, seats: newPrice.seats.toString(), billing_interval: billingInterval },
        });

        await appDb
          .update(tenants)
          .set({
            currentStripePriceId: newPrice.priceId,
            maxUsers: newPrice.seats,
            subscriptionPlan: tier,
            billingInterval,
          })
          .where(eq(tenants.id, tenantId));

        let deactivatedUserCount = 0;

        if (!isUpgrade || isOnTrial) {
          const newMax = newPrice.seats;
          const [{ activeUsers }] = await appDb
            .select({ activeUsers: count() })
            .from(users)
            .where(and(eq(users.tenantId, tenantId), eq(users.active, true)));

          if (activeUsers > newMax) {
            const excessCount = activeUsers - newMax;

            const adminRoleRows = await appDb
              .select({ id: roles.id })
              .from(roles)
              .where(and(eq(roles.tenantId, tenantId), eq(roles.code, ROLE_CODES.ADMIN)));
            const adminRoleIds = adminRoleRows.map((r) => r.id);

            const adminUserRows = adminRoleIds.length
              ? await appDb
                  .select({ userId: userRoles.userId })
                  .from(userRoles)
                  .where(and(inArray(userRoles.roleId, adminRoleIds), eq(userRoles.userId, users.id)))
              : [];

            const nonAdminActiveUsers = await appDb
              .select({ id: users.id })
              .from(users)
              .where(and(eq(users.tenantId, tenantId), eq(users.active, true)))
              .orderBy(users.createdAt);

            const adminUserIds = new Set(adminUserRows.map((r) => r.userId));
            const toDeactivate = nonAdminActiveUsers
              .filter((u) => !adminUserIds.has(u.id))
              .slice(0, excessCount);

            if (toDeactivate.length > 0) {
              await appDb
                .update(users)
                .set({ active: false, updatedAt: new Date() })
                .where(
                  and(
                    eq(users.tenantId, tenantId),
                    inArray(
                      users.id,
                      toDeactivate.map((u) => u.id)
                    )
                  )
                );
              deactivatedUserCount = toDeactivate.length;
            }
          }
        }

        logEventAsync({
          level: "info",
          category: "subscription",
          eventType: "plan_changed",
          message: `Subscription plan ${isUpgrade ? "upgraded" : "downgraded"}`,
          metadata: {
            tenantId,
            fromPriceId: tenantData.currentStripePriceId,
            toPriceId: newPrice.priceId,
            tier,
            billingInterval,
            isOnTrial,
            isUpgrade,
            deactivatedUserCount,
          },
        });

        return {
          success: true,
          isUpgrade,
          isOnTrial,
          newPriceId: newPrice.priceId,
          tier,
          seats: newPrice.seats,
          deactivatedUserCount,
        };
      } catch (error) {
        logEventAsync({
          level: "error",
          category: "stripe",
          eventType: "change_plan_failed",
          message: "Failed to change subscription plan",
          metadata: { error: serializeLogError(error) },
        });
        throw error;
      }
    }),

  addWebsiteBuilder: protectedProcedure
    .use(requirePermission(PERMISSIONS.SETTINGS_MANAGE))
    .input(z.object({ billingInterval: intervalSchema }))
    .mutation(async ({ input, ctx }) => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const tenantId = (ctx as any).tenantId;
        const { billingInterval } = input;

        const tenant = await appDb
          .select()
          .from(tenants)
          .where(eq(tenants.id, tenantId))
          .limit(1);

        if (!tenant.length) throw new TRPCError({ code: "NOT_FOUND", message: "Tenant not found" });

        const tenantData = tenant[0];

        if (!tenantData.stripeSubscriptionId) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "No active subscription" });
        }

        if (tenantData.hasWebsiteBuilder) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Website Builder already active" });
        }

        const wbPrice = await getWebsiteBuilderPrice(billingInterval);
        const stripe = getStripeClient();

        await stripe.subscriptions.update(tenantData.stripeSubscriptionId, {
          items: [{ price: wbPrice.priceId, quantity: 1 }],
          proration_behavior: "create_prorations",
        });

        await appDb
          .update(tenants)
          .set({ hasWebsiteBuilder: true, websiteBuilderPriceId: wbPrice.priceId })
          .where(eq(tenants.id, tenantId));

        logEventAsync({
          level: "info",
          category: "subscription",
          eventType: "website_builder_added",
          message: "Website Builder add-on added",
          metadata: { tenantId, priceId: wbPrice.priceId, billingInterval },
        });

        return { success: true };
      } catch (error) {
        logEventAsync({
          level: "error",
          category: "stripe",
          eventType: "add_website_builder_failed",
          message: "Failed to add Website Builder add-on",
          metadata: { error: serializeLogError(error) },
        });
        throw error;
      }
    }),

  removeWebsiteBuilder: protectedProcedure
    .use(requirePermission(PERMISSIONS.SETTINGS_MANAGE))
    .mutation(async ({ ctx }) => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const tenantId = (ctx as any).tenantId;

        const tenant = await appDb
          .select()
          .from(tenants)
          .where(eq(tenants.id, tenantId))
          .limit(1);

        if (!tenant.length) throw new TRPCError({ code: "NOT_FOUND", message: "Tenant not found" });

        const tenantData = tenant[0];

        if (!tenantData.stripeSubscriptionId || !tenantData.hasWebsiteBuilder) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "No active Website Builder subscription" });
        }

        const stripe = getStripeClient();
        const subscription = await stripe.subscriptions.retrieve(tenantData.stripeSubscriptionId);

        // Resolve the Website Builder subscription item by stored price ID
        const wbItemId = tenantData.websiteBuilderPriceId
          ? subscription.items.data.find((item) => item.price.id === tenantData.websiteBuilderPriceId)?.id
          : undefined;

        if (!wbItemId) {
          // Sync DB even if Stripe item not found
          await appDb
            .update(tenants)
            .set({ hasWebsiteBuilder: false, websiteBuilderPriceId: null })
            .where(eq(tenants.id, tenantId));
          return { success: true };
        }

        await stripe.subscriptions.update(tenantData.stripeSubscriptionId, {
          items: [{ id: wbItemId, deleted: true }],
          proration_behavior: "none",
        });

        await appDb
          .update(tenants)
          .set({ hasWebsiteBuilder: false, websiteBuilderPriceId: null })
          .where(eq(tenants.id, tenantId));

        logEventAsync({
          level: "info",
          category: "subscription",
          eventType: "website_builder_removed",
          message: "Website Builder add-on removed",
          metadata: { tenantId },
        });

        return { success: true };
      } catch (error) {
        logEventAsync({
          level: "error",
          category: "stripe",
          eventType: "remove_website_builder_failed",
          message: "Failed to remove Website Builder add-on",
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
        throw new TRPCError({ code: "UNAUTHORIZED", message: "No tenant context" });
      }

      const tenant = await appDb
        .select()
        .from(tenants)
        .where(eq(tenants.id, tenantId))
        .limit(1);

      if (!tenant.length) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Tenant not found" });
      }

      const tenantData = tenant[0];
      const currentTier = tenantData.currentStripePriceId
        ? await getTierByPriceId(tenantData.currentStripePriceId)
        : null;

      return {
        status: tenantData.subscriptionStatus,
        plan: tenantData.subscriptionPlan as TierName,
        billingInterval: tenantData.billingInterval as BillingInterval,
        maxUsers: tenantData.maxUsers,
        currentTier,
        trialEndsAt: tenantData.trialEndsAt,
        deactivatedAt: tenantData.deactivatedAt,
        lastPaymentFailedAt: tenantData.lastPaymentFailedAt,
        cancelledAtPeriodEnd: tenantData.cancelledAtPeriodEnd,
        paymentFailureCount: tenantData.paymentFailureCount || 0,
        paymentGracePeriodEndsAt: tenantData.paymentGracePeriodEndsAt,
        trialDaysUsed: tenantData.trialDaysUsed || 0,
        originalTrialEndsAt: tenantData.originalTrialEndsAt,
        hasWebsiteBuilder: tenantData.hasWebsiteBuilder,
        pioneerTier: tenantData.pioneerTier,
        isTrialing:
          tenantData.subscriptionStatus === "trial" &&
          tenantData.trialEndsAt &&
          new Date(tenantData.trialEndsAt) > new Date(),
        daysUntilTrialEnds: tenantData.trialEndsAt
          ? Math.ceil(
              (new Date(tenantData.trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
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

        if (!tenant.length) throw new TRPCError({ code: "NOT_FOUND", message: "Tenant not found" });

        const tenantData = tenant[0];

        if (!tenantData.stripeSubscriptionId) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "No active subscription found" });
        }

        const stripe = getStripeClient();
        const subscription = await stripe.subscriptions.update(tenantData.stripeSubscriptionId, {
          cancel_at_period_end: true,
        });

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

        if (!tenant.length) throw new TRPCError({ code: "NOT_FOUND", message: "Tenant not found" });

        const tenantData = tenant[0];

        if (!tenantData.stripeSubscriptionId) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "No active subscription found" });
        }

        if (!tenantData.cancelledAtPeriodEnd) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Subscription is not scheduled for cancellation" });
        }

        const stripe = getStripeClient();
        await stripe.subscriptions.update(tenantData.stripeSubscriptionId, { cancel_at_period_end: false });
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

        if (!tenant.length) throw new TRPCError({ code: "NOT_FOUND", message: "Tenant not found" });

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

        return { success: true, message: "Subscription reactivated" };
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
