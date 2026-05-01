"use client";

import React, { useEffect } from "react";
import { PreferencesProvider } from "@/lib/user/preferences-context";
import { useLocale } from "@/lib/locale/context";
import { trpc } from "@/lib/trpc/client";

/**
 * Loads user preferences on app initialization and provides them to the app.
 * Syncs database preferences to other contexts (e.g., locale).
 * Placed inside TRPCProvider so it can call trpc queries.
 */
export function PreferencesLoader({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: preferences, isLoading } = trpc.user.getPreferences.useQuery();
  const { setLocale } = useLocale();

  // Sync database locale to LocaleProvider
  useEffect(() => {
    if (preferences?.locale && (preferences.locale === "de" || preferences.locale === "en")) {
      setLocale(preferences.locale);
    }
  }, [preferences?.locale, setLocale]);

  return (
    <PreferencesProvider preferences={preferences || null} isLoading={isLoading}>
      {children}
    </PreferencesProvider>
  );
}
