import { createTRPCRouter, publicProcedure, protectedProcedure } from "@/server/trpc";
import { z } from "zod";
import { tenants, users, featureFlags, accountDeletionRequests } from "@/lib/db/schema";
import { db as appDb } from "@/lib/db/client";
import { eq } from "drizzle-orm";
import { randomUUID, randomBytes } from "crypto";
import { sendAccountDeletionEmail } from "@/lib/email/service";
import { getMainDomain } from "@/lib/env";
import { writeAuditLog } from "@/server/audit";

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
        .select({ tenantId: users.tenantId, role: users.role })
        .from(users)
        .where(eq(users.clerkId, ctx.userId))
        .limit(1);

      if (!user || user.role !== "admin") {
        throw new Error("Only admins can delete a practice");
      }

      if (user.tenantId !== input.tenantId) {
        throw new Error("Can only delete your own practice");
      }

      // Get all users in this tenant to delete from Clerk
      const tenantUsers = await ctx.db
        .select({ clerkId: users.clerkId })
        .from(users)
        .where(eq(users.tenantId, input.tenantId));

      // Delete from Clerk (best effort - continue even if Clerk deletion fails)
      const clerkSecretKey = process.env.CLERK_SECRET_KEY;
      if (clerkSecretKey && tenantUsers.length > 0) {
        try {
          for (const u of tenantUsers) {
            const response = await fetch(`https://api.clerk.com/v1/users/${u.clerkId}`, {
              method: "DELETE",
              headers: {
                Authorization: `Bearer ${clerkSecretKey}`,
              },
            });
            if (!response.ok && response.status !== 404) {
              console.error(`Failed to delete Clerk user ${u.clerkId}:`, response.statusText);
            }
          }
        } catch (error) {
          console.error("Error deleting Clerk users:", error);
          // Don't fail the entire operation if Clerk deletion fails
        }
      }

      // Delete the tenant (cascades delete all related data)
      const [deletedTenant] = await ctx.db
        .delete(tenants)
        .where(eq(tenants.id, input.tenantId))
        .returning();

      if (!deletedTenant) {
        throw new Error("Practice not found");
      }

      await writeAuditLog(ctx, {
        tenantId: input.tenantId,
        action: "delete",
        entity: { type: "tenant", id: input.tenantId },
        event: "tenant.deleted",
        summary: "Tenant deleted by admin",
        changes: { deletedSlug: deletedTenant.slug },
      });

      console.log(`Practice deleted: ${deletedTenant.slug} (${deletedTenant.id})`);
      return { success: true, deletedSlug: deletedTenant.slug };
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

      // Generate deletion token
      const token = randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

      // Create deletion request
      const [deletionRequest] = await ctx.db
        .insert(accountDeletionRequests)
        .values({
          id: randomUUID(),
          tenantId: input.tenantId,
          userId: input.userId,
          token,
          email: user.email,
          expiresAt,
          status: "pending",
        })
        .returning();

      await writeAuditLog(ctx, {
        tenantId: input.tenantId,
        action: "delete",
        entity: { type: "account_deletion_request", id: deletionRequest.id },
        event: "tenant.deletion_requested",
        summary: "Tenant deletion requested",
        changes: { expiresAt: deletionRequest.expiresAt.toISOString() },
      });

      // Send confirmation email
      const domain = getMainDomain();
      const confirmUrl = `${domain}/api/tenant/confirm-deletion?token=${token}`;

      try {
        await sendAccountDeletionEmail({
          to: user.email || "",
          confirmUrl,
          expiresAt: expiresAt.toLocaleString("de-DE"),
        });
      } catch (error) {
        console.error("Failed to send deletion email:", error);
        // Delete the request if email fails
        await ctx.db.delete(accountDeletionRequests).where(eq(accountDeletionRequests.id, deletionRequest.id));
        throw new Error("Failed to send confirmation email");
      }

      return { success: true, message: "Confirmation email sent" };
    }),

  confirmDeletion: publicProcedure
    .input(z.object({ token: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Find valid deletion request
      const [deletionRequest] = await ctx.db
        .select()
        .from(accountDeletionRequests)
        .where(eq(accountDeletionRequests.token, input.token))
        .limit(1);

      if (!deletionRequest) {
        throw new Error("Invalid or expired deletion token");
      }

      if (deletionRequest.status !== "pending") {
        throw new Error("This deletion request has already been processed");
      }

      if (new Date() > deletionRequest.expiresAt) {
        throw new Error("Deletion token has expired (24 hours)");
      }

      // Mark as confirmed
      await ctx.db
        .update(accountDeletionRequests)
        .set({ status: "confirmed", confirmedAt: new Date() })
        .where(eq(accountDeletionRequests.id, deletionRequest.id));

      await writeAuditLog(ctx, {
        tenantId: deletionRequest.tenantId,
        action: "delete",
        entity: { type: "account_deletion_request", id: deletionRequest.id },
        event: "tenant.deletion_confirmed",
        summary: "Tenant deletion confirmed via token",
        changes: { confirmedAt: new Date().toISOString() },
      });

      // Get all users in this tenant to delete from Clerk
      const tenantUsers = await ctx.db
        .select({ clerkId: users.clerkId })
        .from(users)
        .where(eq(users.tenantId, deletionRequest.tenantId));

      // Delete from Clerk (best effort)
      const clerkSecretKey = process.env.CLERK_SECRET_KEY;
      if (clerkSecretKey && tenantUsers.length > 0) {
        try {
          for (const u of tenantUsers) {
            const response = await fetch(`https://api.clerk.com/v1/users/${u.clerkId}`, {
              method: "DELETE",
              headers: {
                Authorization: `Bearer ${clerkSecretKey}`,
              },
            });
            if (!response.ok && response.status !== 404) {
              console.error(`Failed to delete Clerk user ${u.clerkId}:`, response.statusText);
            }
          }
        } catch (error) {
          console.error("Error deleting Clerk users:", error);
        }
      }

      // Delete the tenant (cascades all related data)
      const [deletedTenant] = await ctx.db
        .delete(tenants)
        .where(eq(tenants.id, deletionRequest.tenantId))
        .returning();

      if (!deletedTenant) {
        throw new Error("Practice not found");
      }

      console.log(`Practice deleted via email confirmation: ${deletedTenant.slug} (${deletedTenant.id})`);

      return { success: true, message: "Account and all data have been deleted" };
    }),
});
