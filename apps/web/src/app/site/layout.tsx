import type { ReactNode } from "react";
import { Inter, Source_Serif_4, IBM_Plex_Sans, Public_Sans } from "next/font/google";

const inter = Inter({ subsets: ["latin"], display: "swap", variable: "--font-inter" });
const sourceSerif4 = Source_Serif_4({ subsets: ["latin"], weight: ["400", "600", "700"], display: "swap", variable: "--font-source-serif-4" });
const ibmPlexSans = IBM_Plex_Sans({ subsets: ["latin"], weight: ["400", "500", "600"], display: "swap", variable: "--font-ibm-plex-sans" });
const publicSans = Public_Sans({ subsets: ["latin"], weight: ["400", "500", "600", "700"], display: "swap", variable: "--font-public-sans" });

export default function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <div className={`${inter.variable} ${sourceSerif4.variable} ${ibmPlexSans.variable} ${publicSans.variable}`}>
      {children}
    </div>
  );
}
