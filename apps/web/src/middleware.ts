import createIntlMiddleware from 'next-intl/middleware';
import { clerkMiddleware, auth } from '@clerk/nextjs/server';
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
    '/((?!_next|_vercel|.*\\..*|static|public|api/(?!trpc)).*)',
  ],
};
