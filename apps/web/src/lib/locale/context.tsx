'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import type { Locale } from '@/i18n.config';
import { locales, defaultLocale } from '@/i18n.config';
import deMessages from '../../../messages/de.json';
import enMessages from '../../../messages/en.json';

interface LocaleContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string) => string;
}

const LocaleContext = createContext<LocaleContextType | undefined>(undefined);

const translations: Record<Locale, Record<string, any>> = {
  de: deMessages,
  en: enMessages,
};

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(defaultLocale);

  useEffect(() => {
    // Get locale from cookie or Accept-Language header on mount
    const cookieLocale = getCookieLocale();
    if (cookieLocale && isValidLocale(cookieLocale)) {
      setLocaleState(cookieLocale);
    } else {
      const headerLocale = getAcceptLanguageLocale();
      if (headerLocale) {
        setLocaleState(headerLocale);
      }
    }
  }, []);

  const setLocale = (newLocale: Locale) => {
    setLocaleState(newLocale);
    setCookieLocale(newLocale);
  };

  const t = (key: string): string => {
    const keys = key.split('.');
    let value: any = translations[locale];
    for (const k of keys) {
      value = value?.[k];
    }
    return typeof value === 'string' ? value : key;
  };

  return (
    <LocaleContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </LocaleContext.Provider>
  );
}

export function useLocale() {
  const context = useContext(LocaleContext);
  if (!context) {
    throw new Error('useLocale must be used within LocaleProvider');
  }
  return context;
}

function getCookieLocale(): Locale | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(/(?:^|; )LOCALE=([^;]*)/);
  const value = match?.[1];
  return value && isValidLocale(value) ? (value as Locale) : null;
}

function setCookieLocale(locale: Locale) {
  if (typeof document === 'undefined') return;
  const expires = new Date();
  expires.setFullYear(expires.getFullYear() + 1);
  document.cookie = `LOCALE=${locale}; path=/; expires=${expires.toUTCString()}`;
}

function getAcceptLanguageLocale(): Locale | null {
  if (typeof navigator === 'undefined') return null;
  const lang = navigator.language.split('-')[0];
  return isValidLocale(lang) ? (lang as Locale) : null;
}

function isValidLocale(value: any): value is Locale {
  return locales.includes(value);
}
