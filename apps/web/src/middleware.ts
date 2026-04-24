import createIntlMiddleware from 'next-intl/middleware';
import { clerkMiddleware } from '@clerk/nextjs/server';
import { locales, defaultLocale } from './i18n.config';

const intlMiddleware = createIntlMiddleware({
  locales,
  defaultLocale,
});

export default clerkMiddleware((auth, request) => {
  const pathname = request.nextUrl.pathname;

  // Skip intl middleware for public slug-based routes
  // These routes use tenant/practice slugs instead of locale prefixes
  const isPublicSlugRoute =
    pathname.startsWith('/book/') ||
    pathname.startsWith('/brand-builder/') ||
    pathname.startsWith('/confirm') ||
    pathname === '/';

  if (isPublicSlugRoute) {
    return; // Skip intl routing for public slug routes, but Clerk is still processed
  }

  return intlMiddleware(request);
});

export const config = {
  matcher: [
    // Exclude static files and _next routes, but include everything else
    '/((?!_next|.*\\..*|static|public).*)',
  ],
};
