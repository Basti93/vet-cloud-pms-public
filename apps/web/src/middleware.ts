import createIntlMiddleware from 'next-intl/middleware';
import { clerkMiddleware } from '@clerk/nextjs/server';
import { locales, defaultLocale } from './i18n.config';

const intlMiddleware = createIntlMiddleware({
  locales,
  defaultLocale,
});

export default clerkMiddleware((auth, request) => {
  const pathname = request.nextUrl.pathname;

  // Skip intl middleware for public slug-based routes and root
  // These routes use tenant/practice slugs instead of locale prefixes
  const skipPatterns = [
    /^\/book\//, // /book/[tenantSlug]
    /^\/brand-builder\//, // /brand-builder/[tenantSlug]
    /^\/[a-z0-9-]+$/, // /[practiceSlug] - root level slug (matches single segment paths)
    /^\/confirm/, // /confirm (public confirmation page)
    /^\/$/, // / - root landing page (must not get locale prefix)
  ];

  const shouldSkip = skipPatterns.some(pattern => pattern.test(pathname));

  if (shouldSkip) {
    return undefined; // Skip all middleware, route as-is
  }

  return intlMiddleware(request);
});

export const config = {
  matcher: [
    '/((?!_next|_vercel|.*\\..*|static|public|api/(?!trpc)).*)',
  ],
};
