import { createTRPCRouter, publicProcedure, protectedProcedure } from "@/server/trpc";
import { z } from "zod";
import { tenants, users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export const tenantRouter = createTRPCRouter({
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
});
