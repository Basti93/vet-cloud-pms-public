import { ClerkProvider } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { ReactNode } from "react";
import { db } from "@/lib/db/client";
import { tenants, users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { generateThemeStyles } from "@/lib/theme-utils";
import DashboardContent from "./_layout-content";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const { userId } = await auth();

  let tenant: { themePreference: string | null; typographyPreference: string | null } | undefined;

  if (userId) {
    const [user] = await db
      .select({ tenantId: users.tenantId })
      .from(users)
      .where(eq(users.clerkId, userId))
      .limit(1);

    if (user) {
      const [found] = await db
        .select({
          themePreference: tenants.themePreference,
          typographyPreference: tenants.typographyPreference,
        })
        .from(tenants)
        .where(eq(tenants.id, user.tenantId))
        .limit(1);
      tenant = found;
    }
  }

  const themeStyle = tenant
    ? generateThemeStyles(tenant.themePreference, tenant.typographyPreference)
    : generateThemeStyles(null, null);

  return (
    <ClerkProvider>
      <div style={themeStyle}>
        <DashboardContent>{children}</DashboardContent>
      </div>
    </ClerkProvider>
  );
}
