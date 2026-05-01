"use client";

import React from "react";
import { PreferencesProvider } from "@/lib/user/preferences-context";
import { trpc } from "@/lib/trpc/client";

/**
 * Loads user preferences on app initialization and provides them to the app.
 * Placed inside TRPCProvider so it can call trpc queries.
 */
export function PreferencesLoader({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: preferences, isLoading } = trpc.user.getPreferences.useQuery();

  return (
    <PreferencesProvider preferences={preferences || null} isLoading={isLoading}>
      {children}
    </PreferencesProvider>
  );
}
