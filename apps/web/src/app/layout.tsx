import type { Metadata } from "next";
import { headers } from "next/headers";
import { auth } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { ClerkProviderWrapper } from "@/components/ClerkProviderWrapper";
import { TRPCProvider } from "@/lib/trpc/provider";
import { PreferencesLoader } from "@/components/PreferencesLoader";
import { LocaleProvider } from "@/lib/locale/context";
import { ToastProvider } from "@/lib/toast/context";
import { ToastContainer } from "@/components/ui/toast";
import { DynamicFavicon } from "@/components/DynamicFavicon";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { EnvironmentBanner } from "@/components/EnvironmentBanner";
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
  // Load user's locale from database on server side
  let initialLocale: "de" | "en" = "de";
  try {
    const { userId } = await auth();
    if (userId) {
      const [user] = await db
        .select({ locale: users.locale })
        .from(users)
        .where(eq(users.clerkId, userId));

      if (user?.locale && (user.locale === "de" || user.locale === "en")) {
        initialLocale = user.locale;
      }
    }
  } catch {
    // Fallback to default if auth or DB query fails
  }

  return (
    <ClerkProviderWrapper>
      <html lang={initialLocale}>
        <body>
          <EnvironmentBanner />
          <TRPCProvider>
            <LocaleProvider initialLocale={initialLocale}>
              <PreferencesLoader>
                <ToastProvider>
                  <DynamicFavicon />
                  {children}
                  <ToastContainer />
                </ToastProvider>
              </PreferencesLoader>
            </LocaleProvider>
          </TRPCProvider>
          <Analytics />
          <SpeedInsights />
        </body>
      </html>
    </ClerkProviderWrapper>
  );
}
