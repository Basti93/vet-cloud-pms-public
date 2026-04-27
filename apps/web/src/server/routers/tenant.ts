import { createTRPCRouter, publicProcedure, protectedProcedure } from "@/server/trpc";
import { z } from "zod";
import { tenants, users, featureFlags } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";

// Helper function to generate a unique slug from tenant name
async function generateUniqueSlug(
  db: any,
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
      // Get current user to retrieve their email
      const [currentUser] = await ctx.db
        .select({ email: users.email })
        .from(users)
        .where(eq(users.clerkId, ctx.userId))
        .limit(1);

      if (!currentUser) {
        throw new Error("User not found");
      }

      // Generate unique slug
      const slug = await generateUniqueSlug(ctx.db, input.name);

      // Create new tenant with sensible defaults
      const [newTenant] = await ctx.db
        .insert(tenants)
        .values({
          name: input.name,
          slug,
          email: currentUser.email,
          country: "DE",
          timezone: "Europe/Berlin",
          subscriptionStatus: "trial",
          subscriptionPlan: "starter",
          maxUsers: 5,
          themePreference: "sage",
          typographyPreference: "modern",
          websiteTemplate: "modern",
        })
        .returning();

      // Associate current user with the new tenant as admin
      const [updatedAdmin] = await ctx.db
        .update(users)
        .set({
          tenantId: newTenant.id,
          role: "admin",
          updatedAt: new Date(),
        })
        .where(eq(users.clerkId, ctx.userId))
        .returning();

      if (!updatedAdmin) {
        throw new Error("Failed to update user");
      }

      // Note: The admin user themselves is the vet for bookings
      // They can add additional vets (staff with role "vet") later

      // Initialize feature flags for this tenant (all disabled by default)
      await ctx.db.insert(featureFlags).values({
        id: randomUUID(),
        tenantId: newTenant.id,
        aiReceptionEnabled: false, // Disabled by default
      });

      return {
        id: newTenant.id,
        name: newTenant.name,
        slug: newTenant.slug,
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
      const updateData: any = {};

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

      const updateData: any = {};
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

      console.log(`Practice deleted: ${deletedTenant.slug} (${deletedTenant.id})`);
      return { success: true, deletedSlug: deletedTenant.slug };
    }),

  getFeatureFlags: protectedProcedure.query(async ({ ctx }) => {
    // Get current user's tenant
    const [user] = await ctx.db
      .select({ tenantId: users.tenantId })
      .from(users)
      .where(eq(users.clerkId, ctx.userId))
      .limit(1);

    if (!user) {
      throw new Error("User not found");
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

      const updateData: any = {};
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

      return { success: true };
    }),
});
