import createIntlMiddleware from 'next-intl/middleware';
import { clerkMiddleware } from '@clerk/nextjs/server';
import { locales, defaultLocale } from './i18n.config';

const intlMiddleware = createIntlMiddleware({
  locales,
  defaultLocale,
});

export default clerkMiddleware((auth, request) => {
  return intlMiddleware(request);
});

export const config = {
  matcher: [
    // Exclude static files and _next routes
    '/((?!_next|.*\\..*|static|public).*)',
  ],
};
