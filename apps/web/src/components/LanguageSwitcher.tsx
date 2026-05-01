'use client';

import { useLocale } from '@/lib/user/preferences-context';
import { locales } from '@/i18n.config';
import { Globe } from 'lucide-react';

const localeNames: Record<string, string> = {
  de: 'Deutsch',
  en: 'English',
};

export function LanguageSwitcher() {
  const { locale, setLocale } = useLocale();

  const handleLocaleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setLocale(e.target.value as any).catch((error) => {
      console.error('Failed to update locale:', error);
    });
  };

  return (
    <div className="flex items-center gap-2">
      <Globe className="w-4 h-4 text-fg/60" />
      <select
        value={locale}
        onChange={handleLocaleChange}
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
