import { clerkMiddleware } from '@clerk/nextjs/server';
import type { Locale } from './i18n.config';
import { locales, defaultLocale } from './i18n.config';
import { NextRequest, NextResponse } from 'next/server';

function getLocaleFromRequest(request: NextRequest): Locale {
  // Check cookie first
  const cookieLocale = request.cookies.get('LOCALE')?.value;
  if (cookieLocale && (locales as readonly string[]).includes(cookieLocale)) {
    return cookieLocale as Locale;
  }

  // Check Accept-Language header
  const acceptLanguage = request.headers.get('accept-language') || '';
  const lang = acceptLanguage.split(',')[0].split('-')[0].toLowerCase();
  if (lang && (locales as readonly string[]).includes(lang)) {
    return lang as Locale;
  }

  return defaultLocale;
}

export default clerkMiddleware((auth, request) => {
  const locale = getLocaleFromRequest(request);
  const response = NextResponse.next();

  // Set locale cookie for client-side use
  response.cookies.set('LOCALE', locale, {
    maxAge: 60 * 60 * 24 * 365, // 1 year
    path: '/',
  });

  // Set html lang attribute via header (will be used by root layout)
  response.headers.set('x-locale', locale);

  return response;
});

export const config = {
  matcher: [
    // Exclude static files and _next routes, but include everything else
    '/((?!_next|.*\\..*|static|public).*)',
  ],
};
