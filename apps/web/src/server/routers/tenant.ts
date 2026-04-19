import { createTRPCRouter, publicProcedure } from "@/server/trpc";
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
        })
        .from(tenants)
        .where(eq(tenants.slug, input.slug))
        .limit(1);

      if (!tenant.length) {
        return null;
      }

      const t = tenant[0];
      return {
        ...t,
        tagline: null,
        monogram: null,
        themePreference: "sage",
        typographyPreference: "modern",
        websiteTemplate: "modern",
      };
    }),
});
