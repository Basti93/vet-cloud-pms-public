export const locales = ['de', 'en'] as const;
export const defaultLocale = 'de' as const;

export type Locale = (typeof locales)[number];

const config = {
  locales,
  defaultLocale,
  localePrefix: 'as-needed' as const,
};

export default config;
