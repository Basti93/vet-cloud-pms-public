import { createTRPCRouter, publicProcedure } from "@/server/trpc";
import { z } from "zod";
import { tenants } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export const tenantRouter = createTRPCRouter({
  getBySlug: publicProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ ctx, input }) => {
      const tenant = await ctx.db
        .select()
        .from(tenants)
        .where(eq(tenants.slug, input.slug))
        .limit(1);

      if (!tenant.length) {
        return null;
      }

      const t = tenant[0];
      return {
        id: t.id,
        name: t.name,
        slug: t.slug,
        email: t.email,
        phone: t.phone,
        address: t.address,
        city: t.city,
        postalCode: t.postalCode,
        country: t.country,
        tagline: t.tagline,
        monogram: t.monogram,
        themePreference: t.themePreference,
        typographyPreference: t.typographyPreference,
        websiteTemplate: t.websiteTemplate,
      };
    }),
});
