"use client";

import React, { createContext, useContext } from "react";
import type { UserPreferences } from "./preferences";

interface PreferencesContextType {
  preferences: UserPreferences | null;
  isLoading: boolean;
}

const PreferencesContext = createContext<PreferencesContextType | undefined>(
  undefined
);

interface PreferencesProviderProps {
  children: React.ReactNode;
  preferences: UserPreferences | null;
  isLoading: boolean;
}

/**
 * UserPreferencesProvider
 *
 * Why: Single query on app start. Scales better than individual cookies.
 * Loads preferences once and provides them to entire app via context.
 */
export function PreferencesProvider({
  children,
  preferences,
  isLoading,
}: PreferencesProviderProps) {
  return (
    <PreferencesContext.Provider value={{ preferences, isLoading }}>
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences() {
  const context = useContext(PreferencesContext);
  if (!context) {
    throw new Error(
      "usePreferences must be used within PreferencesProvider"
    );
  }
  return context;
}
