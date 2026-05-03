import { createTRPCRouter, publicProcedure, protectedProcedure } from "@/server/trpc";
import { z } from "zod";
import {
  tenants,
  users,
  featureFlags,
  tenantDeletionSchedules,
} from "@/lib/db/schema";
import { db as appDb } from "@/lib/db/client";
import { and, eq } from "drizzle-orm";
import { randomUUID, randomBytes } from "crypto";
import { sendTenantDeactivationEmail } from "@/lib/email/service";
import { getMainDomain } from "@/lib/env";
import { writeAuditLog } from "@/server/audit";
import { logEventAsync, serializeLogError } from "@/server/trpc/logging-middleware";

// Helper function to generate a unique slug from tenant name
async function generateUniqueSlug(
  db: typeof appDb,
  baseName: string
): Promise<string> {
  // Convert to lowercase, remove special chars, replace spaces with hyphens
  let slug = baseName
    .toLowerCase()
    .replace(/[^\w\s-]/g, "") // Remove special characters
    .replace(/\s+/g, "-") // Replace spaces with hyphens
    .replace(/-+/g, "-") // Replace multiple hyphens with single
    .trim();

  if (!slug) slug = "practice"; // Fallback if name becomes empty

  // Check if slug exists, and if so, append a random suffix
  let finalSlug = slug;
  let counter = 1;
  while (true) {
    const existing = await db
      .select({ id: tenants.id })
      .from(tenants)
      .where(eq(tenants.slug, finalSlug))
      .limit(1);

    if (!existing.length) {
      break;
    }

    finalSlug = `${slug}-${counter}`;
    counter++;
  }

  return finalSlug;
}

async function scheduleTenantDeletionFor30Days(
  ctx: { db: typeof appDb; userId: string | null },
  {
    tenantId,
    actorUserId,
    actorEmail,
    tenantEmail,
    practiceName,
    reason,
  }: {
    tenantId: string;
    actorUserId: string;
    actorEmail: string;
    tenantEmail?: string | null;
    practiceName: string;
    reason: string;
  }
) {
  const scheduledFor = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const reactivationToken = randomBytes(32).toString("hex");
  const reactivationTokenExpiresAt = scheduledFor;

  const [existing] = await ctx.db
    .select({ id: tenantDeletionSchedules.id })
    .from(tenantDeletionSchedules)
    .where(eq(tenantDeletionSchedules.tenantId, tenantId))
    .limit(1);

  if (existing) {
    await ctx.db
      .update(tenantDeletionSchedules)
      .set({
        status: "scheduled",
        reason,
        scheduledFor,
        cancelledAt: null,
        executedAt: null,
        reactivationToken,
        reactivationTokenExpiresAt,
        updatedAt: new Date(),
      })
      .where(eq(tenantDeletionSchedules.id, existing.id));
  } else {
    await ctx.db.insert(tenantDeletionSchedules).values({
      tenantId,
      requestedByUserId: actorUserId,
      status: "scheduled",
      reason,
      scheduledFor,
      reactivationToken,
      reactivationTokenExpiresAt,
    });
  }

  await ctx.db
    .update(tenants)
    .set({ subscriptionStatus: "paused", updatedAt: new Date() })
    .where(eq(tenants.id, tenantId));

  const recipient = actorEmail || tenantEmail || "";
  if (!recipient) {
    logEventAsync({
      level: "warn",
      category: "email",
      eventType: "tenant_deactivation_email_missing_recipient",
      message: "Tenant deactivation email was not sent: no recipient available",
      tenantId,
      userId: actorUserId,
      metadata: { reason, practiceName },
    });
    console.warn(
      "Tenant deactivation completed without notification email: no recipient email available."
    );
    return { scheduledFor, emailSent: false };
  }

  const reactivateUrl = `${getMainDomain()}/api/tenant/reactivate?token=${reactivationToken}`;
  const emailResult = await sendTenantDeactivationEmail({
    to: recipient,
    practiceName,
    scheduledFor: scheduledFor.toLocaleString("de-DE"),
    reactivateUrl,
  });
  if (!emailResult.success) {
    const serializedError = serializeLogError(emailResult.error);
    logEventAsync({
      level: "error",
      category: "email",
      eventType: "tenant_deactivation_email_failed",
      message: "Tenant deactivation completed, but notification email failed",
      tenantId,
      userId: actorUserId,
      metadata: {
        recipient,
        reason,
        practiceName,
        operation: "tenant_deactivation_notification",
        provider: "resend",
        ...serializedError,
      },
    });
    console.warn(
      "Tenant deactivation completed, but notification email failed.",
      emailResult.error
    );
  }

  return { scheduledFor, emailSent: emailResult.success };
}

export const tenantRouter = createTRPCRouter({
  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(255),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Get current user and their placeholder tenant
      const [currentUser] = await ctx.db
        .select({ email: users.email, tenantId: users.tenantId })
        .from(users)
        .where(eq(users.clerkId, ctx.userId))
        .limit(1);

      if (!currentUser || !currentUser.tenantId) {
        throw new Error("User not found or has no placeholder tenant");
      }

      // Generate unique slug for the practice name
      const slug = await generateUniqueSlug(ctx.db, input.name);

      // Update placeholder tenant with actual practice details
      const [updatedTenant] = await ctx.db
        .update(tenants)
        .set({
          name: input.name,
          slug,
          country: "DE",
          timezone: "Europe/Berlin",
          subscriptionStatus: "trial",
          subscriptionPlan: "starter",
          maxUsers: 5,
          themePreference: "sage",
          typographyPreference: "modern",
          websiteTemplate: "modern",
          updatedAt: new Date(),
        })
        .where(eq(tenants.id, currentUser.tenantId))
        .returning();

      // Update user role to admin
      await ctx.db
        .update(users)
        .set({
          role: "admin",
          updatedAt: new Date(),
        })
        .where(eq(users.clerkId, ctx.userId));

      // Initialize feature flags for this tenant (if not already created)
      // Try insert, ignore if already exists
      try {
        await ctx.db.insert(featureFlags).values({
          id: randomUUID(),
          tenantId: currentUser.tenantId,
          aiReceptionEnabled: false, // Disabled by default
        });
      } catch (_error) {
        // Feature flags already exist, that's fine
      }

      console.log(`Practice created: ${updatedTenant.slug} (${updatedTenant.id})`);

      await writeAuditLog(ctx, {
        tenantId: updatedTenant.id,
        action: "create",
        entity: { type: "tenant", id: updatedTenant.id },
        event: "tenant.created_from_placeholder",
        summary: "Practice created from placeholder tenant",
        changes: { slug: updatedTenant.slug, nameSet: Boolean(updatedTenant.name) },
      });

      return {
        id: updatedTenant.id,
        name: updatedTenant.name,
        slug: updatedTenant.slug,
      };
    }),
  getBySlug: publicProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ ctx, input }) => {
      const tenant = await ctx.db
        .select({
          id: tenants.id,
          name: tenants.name,
          slug: tenants.slug,
          email: tenants.email,
          phone: tenants.phone,
          address: tenants.address,
          city: tenants.city,
          postalCode: tenants.postalCode,
          country: tenants.country,
          tagline: tenants.tagline,
          monogram: tenants.monogram,
          themePreference: tenants.themePreference,
          typographyPreference: tenants.typographyPreference,
          websiteTemplate: tenants.websiteTemplate,
        })
        .from(tenants)
        .where(eq(tenants.slug, input.slug))
        .limit(1);

      if (!tenant.length) {
        return null;
      }

      return tenant[0];
    }),

  updateTheme: protectedProcedure
    .input(
      z.object({
        tenantId: z.string().uuid(),
        brandName: z.string().optional(),
        tagline: z.string().optional(),
        monogram: z.string().optional(),
        themePreference: z.string().optional(),
        typographyPreference: z.string().optional(),
        websiteTemplate: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { tenantId, ...updates } = input;
      const updateData: Record<string, unknown> = {};

      if (updates.brandName !== undefined) updateData.name = updates.brandName;
      if (updates.tagline !== undefined) updateData.tagline = updates.tagline;
      if (updates.monogram !== undefined) updateData.monogram = updates.monogram;
      if (updates.themePreference !== undefined)
        updateData.themePreference = updates.themePreference;
      if (updates.typographyPreference !== undefined)
        updateData.typographyPreference = updates.typographyPreference;
      if (updates.websiteTemplate !== undefined)
        updateData.websiteTemplate = updates.websiteTemplate;

      await ctx.db.update(tenants).set(updateData).where(eq(tenants.id, tenantId));

      await writeAuditLog(ctx, {
        tenantId,
        action: "config_change",
        entity: { type: "tenant", id: tenantId },
        event: "tenant.theme_updated",
        summary: "Tenant branding/theme updated",
        changes: {
          updatedFields: Object.keys(updateData),
        },
      });

      return { success: true };
    }),

  getCurrent: protectedProcedure.query(async ({ ctx }) => {
    const [user] = await ctx.db
      .select({ tenantId: users.tenantId })
      .from(users)
      .where(eq(users.clerkId, ctx.userId))
      .limit(1);

    if (!user) return null;

    const [tenant] = await ctx.db
      .select({
        id: tenants.id,
        name: tenants.name,
        slug: tenants.slug,
        email: tenants.email,
        phone: tenants.phone,
        address: tenants.address,
        city: tenants.city,
        postalCode: tenants.postalCode,
        tagline: tenants.tagline,
        monogram: tenants.monogram,
        themePreference: tenants.themePreference,
        typographyPreference: tenants.typographyPreference,
        websiteTemplate: tenants.websiteTemplate,
      })
      .from(tenants)
      .where(eq(tenants.id, user.tenantId))
      .limit(1);

    return tenant || null;
  }),

  getDeletionStatus: protectedProcedure.query(async ({ ctx }) => {
    const [user] = await ctx.db
      .select({ tenantId: users.tenantId })
      .from(users)
      .where(eq(users.clerkId, ctx.userId))
      .limit(1);

    if (!user?.tenantId) return null;

    const [tenant] = await ctx.db
      .select({
        id: tenants.id,
        name: tenants.name,
        slug: tenants.slug,
        subscriptionStatus: tenants.subscriptionStatus,
      })
      .from(tenants)
      .where(eq(tenants.id, user.tenantId))
      .limit(1);

    if (!tenant) return null;

    const [schedule] = await ctx.db
      .select({
        status: tenantDeletionSchedules.status,
        scheduledFor: tenantDeletionSchedules.scheduledFor,
        cancelledAt: tenantDeletionSchedules.cancelledAt,
      })
      .from(tenantDeletionSchedules)
      .where(
        and(
          eq(tenantDeletionSchedules.tenantId, tenant.id),
          eq(tenantDeletionSchedules.status, "scheduled")
        )
      )
      .limit(1);

    return {
      tenantId: tenant.id,
      tenantName: tenant.name,
      tenantSlug: tenant.slug,
      subscriptionStatus: tenant.subscriptionStatus,
      isDeactivationScheduled: Boolean(schedule),
      scheduledFor: schedule?.scheduledFor ?? null,
      deletionStatus: schedule?.status ?? null,
      cancelledAt: schedule?.cancelledAt ?? null,
    };
  }),

  update: protectedProcedure
    .input(
      z.object({
        name: z.string().optional(),
        email: z.string().email().optional(),
        phone: z.string().optional(),
        address: z.string().optional(),
        city: z.string().optional(),
        postalCode: z.string().optional(),
        tagline: z.string().optional(),
        monogram: z.string().max(3).optional(),
        themePreference: z.enum(["sage", "warmsand", "klinikblau", "bordeaux", "forest", "schiefer"]).optional(),
        typographyPreference: z.enum(["modern", "klassisch", "klinisch", "freundlich"]).optional(),
        websiteTemplate: z.enum(["klassik", "modern", "kompakt"]).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [user] = await ctx.db
        .select({ tenantId: users.tenantId })
        .from(users)
        .where(eq(users.clerkId, ctx.userId))
        .limit(1);

      if (!user) {
        throw new Error("User not found");
      }

      const updateData: Record<string, unknown> = {};
      if (input.name !== undefined) updateData.name = input.name;
      if (input.email !== undefined) updateData.email = input.email;
      if (input.phone !== undefined) updateData.phone = input.phone;
      if (input.address !== undefined) updateData.address = input.address;
      if (input.city !== undefined) updateData.city = input.city;
      if (input.postalCode !== undefined) updateData.postalCode = input.postalCode;
      if (input.tagline !== undefined) updateData.tagline = input.tagline;
      if (input.monogram !== undefined) updateData.monogram = input.monogram;
      if (input.themePreference !== undefined) updateData.themePreference = input.themePreference;
      if (input.typographyPreference !== undefined) updateData.typographyPreference = input.typographyPreference;
      if (input.websiteTemplate !== undefined) updateData.websiteTemplate = input.websiteTemplate;

      await ctx.db.update(tenants).set(updateData).where(eq(tenants.id, user.tenantId));

      await writeAuditLog(ctx, {
        tenantId: user.tenantId,
        action: "update",
        entity: { type: "tenant", id: user.tenantId },
        event: "tenant.profile_updated",
        summary: "Tenant profile updated",
        changes: {
          updatedFields: Object.keys(updateData),
        },
      });

      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ tenantId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      // Get current user's role and tenantId
      const [user] = await ctx.db
        .select({ id: users.id, tenantId: users.tenantId, role: users.role, email: users.email })
        .from(users)
        .where(eq(users.clerkId, ctx.userId))
        .limit(1);

      if (!user || user.role !== "admin") {
        throw new Error("Only admins can delete a practice");
      }

      if (user.tenantId !== input.tenantId) {
        throw new Error("Can only delete your own practice");
      }

      const [tenant] = await ctx.db
        .select({ id: tenants.id, slug: tenants.slug, name: tenants.name, email: tenants.email })
        .from(tenants)
        .where(eq(tenants.id, input.tenantId))
        .limit(1);

      if (!tenant) {
        throw new Error("Practice not found");
      }

      const result = await scheduleTenantDeletionFor30Days(ctx, {
        tenantId: input.tenantId,
        actorUserId: user.id,
        actorEmail: user.email ?? "",
        tenantEmail: tenant.email,
        practiceName: tenant.name,
        reason: "Requested from practice settings",
      });

      await writeAuditLog(ctx, {
        tenantId: input.tenantId,
        action: "delete",
        entity: { type: "tenant", id: input.tenantId },
        event: "tenant.deactivation_scheduled",
        summary: "Tenant deletion scheduled (+30 days) from practice settings",
        changes: { slug: tenant.slug, scheduledFor: result.scheduledFor.toISOString() },
      });

      return {
        success: true,
        scheduledFor: result.scheduledFor.toISOString(),
        emailSent: result.emailSent,
      };
    }),

  getFeatureFlags: protectedProcedure.query(async ({ ctx }) => {
    try {
      // Get current user's tenant
      const [user] = await ctx.db
        .select({ tenantId: users.tenantId })
        .from(users)
        .where(eq(users.clerkId, ctx.userId))
        .limit(1);

      if (!user) {
        // Return default flags if user not found in DB (e.g., webhook not processed yet)
        return {
          aiReceptionEnabled: false,
        };
      }

      // Get feature flags for this tenant
      const [flags] = await ctx.db
        .select({
          aiReceptionEnabled: featureFlags.aiReceptionEnabled,
        })
        .from(featureFlags)
        .where(eq(featureFlags.tenantId, user.tenantId))
        .limit(1);

      // Return default flags if none exist yet
      return {
        aiReceptionEnabled: flags?.aiReceptionEnabled ?? false,
      };
    } catch (error) {
      // Log error and return safe defaults
      console.error("Error fetching feature flags:", error);
      return {
        aiReceptionEnabled: false,
      };
    }
  }),

  updateFeatureFlags: protectedProcedure
    .input(
      z.object({
        aiReceptionEnabled: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Get current user's tenant and role
      const [user] = await ctx.db
        .select({ tenantId: users.tenantId, role: users.role })
        .from(users)
        .where(eq(users.clerkId, ctx.userId))
        .limit(1);

      if (!user || user.role !== "admin") {
        throw new Error("Only admins can update feature flags");
      }

      // Check if feature flags exist for this tenant
      const [existing] = await ctx.db
        .select({ id: featureFlags.id })
        .from(featureFlags)
        .where(eq(featureFlags.tenantId, user.tenantId))
        .limit(1);

      const updateData: Record<string, unknown> = {};
      if (input.aiReceptionEnabled !== undefined) {
        updateData.aiReceptionEnabled = input.aiReceptionEnabled;
      }
      updateData.updatedAt = new Date();

      if (existing) {
        // Update existing
        await ctx.db
          .update(featureFlags)
          .set(updateData)
          .where(eq(featureFlags.tenantId, user.tenantId));
      } else {
        // Create new
        await ctx.db.insert(featureFlags).values({
          id: randomUUID(),
          tenantId: user.tenantId,
          ...updateData,
        });
      }

      await writeAuditLog(ctx, {
        tenantId: user.tenantId,
        action: "config_change",
        entity: { type: "feature_flags", id: user.tenantId },
        event: "tenant.feature_flags_updated",
        summary: "Tenant feature flags updated",
        changes: input,
      });

      return { success: true };
    }),

  requestDeletion: protectedProcedure
    .input(z.object({ tenantId: z.string().uuid(), userId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      // Get current user
      const [user] = await ctx.db
        .select({ id: users.id, tenantId: users.tenantId, email: users.email, role: users.role })
        .from(users)
        .where(eq(users.clerkId, ctx.userId))
        .limit(1);

      if (!user || user.role !== "admin") {
        throw new Error("Only admins can request account deletion");
      }

      if (user.tenantId !== input.tenantId) {
        throw new Error("Can only delete your own practice");
      }

      // Verify the userId matches the current user
      if (input.userId !== user.id) {
        throw new Error("Can only request deletion for your own account");
      }

      const [tenant] = await ctx.db
        .select({ name: tenants.name, email: tenants.email })
        .from(tenants)
        .where(eq(tenants.id, input.tenantId))
        .limit(1);
      if (!tenant) throw new Error("Practice not found");

      const result = await scheduleTenantDeletionFor30Days(ctx, {
        tenantId: input.tenantId,
        actorUserId: user.id,
        actorEmail: user.email ?? "",
        tenantEmail: tenant.email,
        practiceName: tenant.name,
        reason: "Requested from account settings",
      });

      await writeAuditLog(ctx, {
        tenantId: input.tenantId,
        action: "delete",
        entity: { type: "tenant", id: input.tenantId },
        event: "tenant.deactivation_scheduled",
        summary: "Tenant deactivated and deletion scheduled (+30 days)",
        changes: { scheduledFor: result.scheduledFor.toISOString() },
      });

      return {
        success: true,
        scheduledFor: result.scheduledFor.toISOString(),
        emailSent: result.emailSent,
      };
    }),
});
