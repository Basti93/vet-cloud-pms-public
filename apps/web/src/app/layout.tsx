import type { Metadata } from "next";
import { headers } from "next/headers";
import { ClerkProviderWrapper } from "@/components/ClerkProviderWrapper";
import { TRPCProvider } from "@/lib/trpc/provider";
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
  const headerList = await headers();
  const locale = (headerList.get("x-locale") as string) || "de";

  return (
    <ClerkProviderWrapper>
      <html lang="de">
        <body>
          <EnvironmentBanner />
          <TRPCProvider>
            <ToastProvider>
              <DynamicFavicon />
              <LocaleProvider>{children}</LocaleProvider>
              <ToastContainer />
            </ToastProvider>
          </TRPCProvider>
          <Analytics />
          <SpeedInsights />
        </body>
      </html>
    </ClerkProviderWrapper>
  );
}
