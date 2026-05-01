'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';
import type { Locale } from '@/i18n.config';
import type { UserPreferences } from './preferences';
import deMessages from '../../../messages/de.json';
import enMessages from '../../../messages/en.json';
import { trpc } from '@/lib/trpc/client';

// Translation messages
const translations: Record<'de' | 'en', Record<string, any>> = {
  de: deMessages,
  en: enMessages,
};

interface UserPreferencesContextType {
  preferences: UserPreferences | null;
  t: (key: string) => string;
  setLocale: (locale: Locale) => Promise<void>;
}

const UserPreferencesContext = createContext<UserPreferencesContextType | undefined>(
  undefined
);

interface UserPreferencesProviderProps {
  children: React.ReactNode;
  preferences: UserPreferences | null;
}

/**
 * UserPreferencesProvider - Provides user preferences (locale, theme, etc.)
 *
 * Server-side (layout.tsx):
 * - Fetches user preferences from database
 * - Passes them here to initialize on first render
 *
 * Client-side:
 * - Provides preferences + utility functions (t for translations, setLocale for updates)
 * - setLocale calls tRPC mutation to persist change, then updates context
 *
 * Architecture:
 * - Preferences loaded server-side = correct language on first paint
 * - Client can update via setLocale = mutation persists to DB + updates context
 */
export function UserPreferencesProvider({
  children,
  preferences: initialPreferences,
}: UserPreferencesProviderProps) {
  const [preferences, setPreferences] = useState<UserPreferences | null>(
    initialPreferences
  );

  const updateLocaleMutation = trpc.user.updateLocale.useMutation();

  // Translation function - loads from the appropriate language file
  const t = useCallback(
    (key: string): string => {
      const locale = preferences?.locale || 'de';
      const keys = key.split('.');
      let value: any = translations[locale as 'de' | 'en'];
      for (const k of keys) {
        value = value?.[k];
      }
      return typeof value === 'string' ? value : key;
    },
    [preferences?.locale]
  );

  // Update locale: call mutation + update context
  const setLocale = useCallback(
    async (newLocale: Locale) => {
      try {
        await updateLocaleMutation.mutateAsync({ locale: newLocale });
        // Update context with new locale
        setPreferences((prev) =>
          prev ? { ...prev, locale: newLocale } : { locale: newLocale }
        );
        // Update HTML lang attribute for accessibility
        if (typeof document !== 'undefined') {
          document.documentElement.lang = newLocale;
        }
      } catch (error) {
        console.error('Failed to update locale:', error);
        throw error;
      }
    },
    [updateLocaleMutation]
  );

  return (
    <UserPreferencesContext.Provider value={{ preferences, t, setLocale }}>
      {children}
    </UserPreferencesContext.Provider>
  );
}

/**
 * useUserPreferences - Access user preferences
 *
 * Usage:
 *   const { preferences } = useUserPreferences();
 *   console.log(preferences?.locale); // "de" or "en"
 */
export function useUserPreferences() {
  const context = useContext(UserPreferencesContext);
  if (!context) {
    throw new Error(
      'useUserPreferences must be used within UserPreferencesProvider'
    );
  }
  return context;
}

/**
 * useLocale - Access locale, setLocale, and translation function
 * Replacement for the old LocaleProvider's useLocale hook
 *
 * Usage:
 *   const { locale, setLocale, t } = useLocale();
 *   const text = t("common.save");
 *   await setLocale("en");
 */
export function useLocale() {
  const { preferences, setLocale, t } = useUserPreferences();
  return {
    locale: (preferences?.locale || 'de') as 'de' | 'en',
    setLocale,
    t,
  };
}
