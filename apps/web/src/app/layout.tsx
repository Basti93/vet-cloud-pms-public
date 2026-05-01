import type { Metadata } from "next";
import { headers } from "next/headers";
import { auth } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { users, tenants } from "@/lib/db/schema";
import { ClerkProviderWrapper } from "@/components/ClerkProviderWrapper";
import { TRPCProvider } from "@/lib/trpc/provider";
import { PraxisProvider } from "@/lib/praxis/context";
import { UserPreferencesProvider } from "@/lib/user/preferences-context";
import { ToastProvider } from "@/lib/toast/context";
import { ToastContainer } from "@/components/ui/toast";
import { DynamicFavicon } from "@/components/DynamicFavicon";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { EnvironmentBanner } from "@/components/EnvironmentBanner";
import type { PraxisPreferences, UserPreferences } from "@/lib/user/preferences";
import "./globals.css";

export const metadata: Metadata = {
  title: "Vet Cloud PMS",
  description: "Modern cloud-based veterinary practice management system",
  robots: "noindex",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Load user preferences + tenant info from database on server side
  // This ensures correct locale/language on first paint with no flashing
  let userPreferences: UserPreferences | null = null;
  let praxisData: PraxisPreferences | null = null;
  let htmlLang: "de" | "en" = "de";

  try {
    const { userId } = await auth();
    if (userId) {
      const [user] = await db
        .select({
          locale: users.locale,
          tenantId: users.tenantId,
        })
        .from(users)
        .where(eq(users.clerkId, userId));

      if (user) {
        // Set user preferences
        if (user.locale && (user.locale === "de" || user.locale === "en")) {
          userPreferences = { locale: user.locale };
          htmlLang = user.locale;
        }

        // Load tenant info
        if (user.tenantId) {
          const [tenant] = await db
            .select({
              id: tenants.id,
              name: tenants.name,
              monogram: tenants.monogram,
            })
            .from(tenants)
            .where(eq(tenants.id, user.tenantId));

          if (tenant) {
            praxisData = {
              tenantId: tenant.id,
              tenantName: tenant.name,
              monogram: tenant.monogram || null,
            };
          }
        }
      }
    }
  } catch {
    // Fallback to defaults if auth or DB query fails
  }

  return (
    <ClerkProviderWrapper>
      <html lang={htmlLang}>
        <body>
          <EnvironmentBanner />
          <TRPCProvider>
            <PraxisProvider praxis={praxisData}>
              <UserPreferencesProvider preferences={userPreferences}>
                <ToastProvider>
                  <DynamicFavicon />
                  {children}
                  <ToastContainer />
                </ToastProvider>
              </UserPreferencesProvider>
            </PraxisProvider>
          </TRPCProvider>
          <Analytics />
          <SpeedInsights />
        </body>
      </html>
    </ClerkProviderWrapper>
  );
}
