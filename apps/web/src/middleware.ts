import { clerkMiddleware } from '@clerk/nextjs/server';
import type { Locale } from './i18n.config';
import { locales, defaultLocale } from './i18n.config';

function getLocaleFromRequest(headers: any): Locale {
  // Check Accept-Language header
  const acceptLanguage = headers.get('accept-language') || '';
  const lang = acceptLanguage.split(',')[0].split('-')[0].toLowerCase();
  if (lang && (locales as readonly string[]).includes(lang)) {
    return lang as Locale;
  }

  return defaultLocale;
}

export default clerkMiddleware((auth, request) => {
  // Get locale from Accept-Language header
  const locale = getLocaleFromRequest(request.headers);

  // Set locale header for the layout to read
  request.headers.set('x-locale', locale);
});

export const config = {
  matcher: [
    // Exclude static files and _next routes, but include everything else
    '/((?!_next|.*\\..*|static|public).*)',
  ],
};
