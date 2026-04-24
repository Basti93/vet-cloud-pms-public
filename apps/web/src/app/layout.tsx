import type { Metadata } from "next";
import { headers } from "next/headers";
import { ClerkProvider } from "@clerk/nextjs";
import { TRPCProvider } from "@/lib/trpc/provider";
import { LocaleProvider } from "@/lib/locale/context";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Vet Cloud PMS",
  description: "Modern cloud-based veterinary practice management system",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const headerList = await headers();
  const locale = (headerList.get("x-locale") as string) || "de";

  return (
    <ClerkProvider>
      <html lang={locale}>
        <body>
          <TRPCProvider>
            <LocaleProvider>{children}</LocaleProvider>
          </TRPCProvider>
          <Analytics />
          <SpeedInsights />
        </body>
      </html>
    </ClerkProvider>
  );
}
