"use client";

import { ClerkProvider } from "@clerk/nextjs";
import { deDE } from "@clerk/localizations";
import { ReactNode } from "react";

export function ClerkProviderWrapper({ children }: { children: ReactNode }) {
  return (
    <ClerkProvider localization={deDE}>
      {children}
    </ClerkProvider>
  );
}
