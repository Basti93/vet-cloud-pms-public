'use client';

import { useLocale } from '@/lib/locale/context';
import { locales } from '@/i18n.config';
import { Globe } from 'lucide-react';

const localeNames: Record<string, string> = {
  de: 'Deutsch',
  en: 'English',
};

export function LanguageSwitcher() {
  const { locale, setLocale } = useLocale();

  return (
    <div className="flex items-center gap-2">
      <Globe className="w-4 h-4 text-fg/60" />
      <select
        value={locale}
        onChange={(e) => setLocale(e.target.value as any)}
        className="text-sm bg-surface border border-border rounded px-2 py-1 text-fg cursor-pointer hover:bg-surface/80"
      >
        {locales.map((lang) => (
          <option key={lang} value={lang}>
            {localeNames[lang]}
          </option>
        ))}
      </select>
    </div>
  );
}
