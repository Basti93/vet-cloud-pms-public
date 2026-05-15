import { ReactNode } from "react";
import type { Metadata } from "next";
import { db } from "@/lib/db/client";
import { tenants } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { generateThemeStyles } from "@/lib/theme-utils";

interface LayoutProps {
  children: ReactNode;
  params: Promise<{ tenantSlug: string }>;
}

export async function generateMetadata({ params }: { params: Promise<{ tenantSlug: string }> }): Promise<Metadata> {
  const { tenantSlug } = await params;
  const [tenant] = await db
    .select({ websiteEnabled: tenants.websiteEnabled })
    .from(tenants)
    .where(eq(tenants.slug, tenantSlug))
    .limit(1);

  if (!tenant?.websiteEnabled) {
    return { robots: { index: false, follow: false } };
  }
  return {};
}

export default async function BookingLayout({ children, params }: LayoutProps) {
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
