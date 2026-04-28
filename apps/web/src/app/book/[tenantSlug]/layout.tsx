import { ReactNode } from "react";
import { db } from "@/lib/db/client";
import { tenants } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { generateThemeStyles, getPrimaryColor } from "@/lib/theme-utils";

export default async function BookingLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;

  const [tenant] = await db
    .select({
      themePreference: tenants.themePreference,
      typographyPreference: tenants.typographyPreference,
    })
    .from(tenants)
    .where(eq(tenants.slug, tenantSlug))
    .limit(1);

  const themeStyle = tenant
    ? generateThemeStyles(tenant.themePreference, tenant.typographyPreference)
    : generateThemeStyles(null, null);

  return (
    <div style={themeStyle}>
      {children}
    </div>
  );
}
