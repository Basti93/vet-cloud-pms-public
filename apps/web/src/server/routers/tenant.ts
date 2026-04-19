import { createTRPCRouter, publicProcedure, protectedProcedure } from "@/server/trpc";
import { z } from "zod";
import { tenants } from "@/lib/db/schema";
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

  getCurrent: publicProcedure.query(async ({ ctx }) => {
    // Get the demo tenant by default
    // TODO: In production, look up user's tenant from users table
    const tenant = await ctx.db
      .select({
        id: tenants.id,
        name: tenants.name,
        slug: tenants.slug,
        email: tenants.email,
        themePreference: tenants.themePreference,
        typographyPreference: tenants.typographyPreference,
        websiteTemplate: tenants.websiteTemplate,
      })
      .from(tenants)
      .where(eq(tenants.slug, 'demo'))
      .limit(1);

    if (!tenant.length) {
      // Fallback to first tenant if demo doesn't exist
      const fallback = await ctx.db
        .select({
          id: tenants.id,
          name: tenants.name,
          slug: tenants.slug,
          email: tenants.email,
          themePreference: tenants.themePreference,
          typographyPreference: tenants.typographyPreference,
          websiteTemplate: tenants.websiteTemplate,
        })
        .from(tenants)
        .limit(1);

      return fallback.length ? fallback[0] : null;
    }

    return tenant[0];
  }),
});
