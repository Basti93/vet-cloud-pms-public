import type { Metadata } from "next";
import { headers } from "next/headers";
import { ClerkProviderWrapper } from "@/components/ClerkProviderWrapper";
import { TRPCProvider } from "@/lib/trpc/provider";
import { LocaleProvider } from "@/lib/locale/context";
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
        <head>
          <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' rx='6' fill='%23558866'/><ellipse cx='16' cy='21' rx='7.5' ry='6' fill='%23fff'/><ellipse cx='7' cy='12.5' rx='2.8' ry='3.2' fill='%23fff'/><ellipse cx='12.5' cy='9' rx='2.8' ry='3.2' fill='%23fff'/><ellipse cx='19.5' cy='9' rx='2.8' ry='3.2' fill='%23fff'/><ellipse cx='25' cy='12.5' rx='2.8' ry='3.2' fill='%23fff'/></svg>" />
          <link rel="apple-touch-icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 180 180'><rect width='180' height='180' rx='40' fill='%23558866'/><ellipse cx='90' cy='120' rx='42' ry='33' fill='%23fff'/><ellipse cx='40' cy='70' rx='15' ry='18' fill='%23fff'/><ellipse cx='70' cy='50' rx='15' ry='18' fill='%23fff'/><ellipse cx='110' cy='50' rx='15' ry='18' fill='%23fff'/><ellipse cx='140' cy='70' rx='15' ry='18' fill='%23fff'/></svg>" />
        </head>
        <body>
          <EnvironmentBanner />
          <TRPCProvider>
            <DynamicFavicon />
            <LocaleProvider>{children}</LocaleProvider>
          </TRPCProvider>
          <Analytics />
          <SpeedInsights />
        </body>
      </html>
    </ClerkProviderWrapper>
  );
}
