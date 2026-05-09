import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { PUBLIC_ROUTES } from '@/config/routes';
import { db } from '@/lib/db/client';
import { tenants } from '@/lib/db/schema';
import { getMainDomain } from '@/lib/env';
import { eq } from 'drizzle-orm';

const isPublicRoute = createRouteMatcher([...PUBLIC_ROUTES]);

function normalizeEmbeddingDomain(domain: string) {
  const trimmed = domain.trim().toLowerCase();
  if (!trimmed) return null;

  try {
    return new URL(trimmed.includes('://') ? trimmed : `https://${trimmed}`).hostname;
  } catch {
    return trimmed.split('/')[0]?.split(':')[0] || null;
  }
}

function frameAncestorSourcesForDomain(domain: string) {
  if (domain === 'localhost') {
    return ['http://localhost:*'];
  }

  if (domain === '127.0.0.1') {
    return ['http://127.0.0.1:*'];
  }

  return [`https://${domain}`, `https://www.${domain}`];
}

async function getBookingFrameAncestors(pathname: string) {
  const tenantSlug = pathname.split('/')[2];
  const mainDomain = normalizeEmbeddingDomain(getMainDomain());

  if (!tenantSlug) {
    return ["'self'", ...(mainDomain ? frameAncestorSourcesForDomain(mainDomain) : [])];
  }

  const [tenant] = await db
    .select({ allowedEmbeddingDomains: tenants.allowedEmbeddingDomains })
    .from(tenants)
    .where(eq(tenants.slug, tenantSlug))
    .limit(1);

  const allowedDomains = (tenant?.allowedEmbeddingDomains as string[] | null) || [];
  const normalizedAllowedDomains = allowedDomains
    .map((domain) => normalizeEmbeddingDomain(domain))
    .filter((domain): domain is string => Boolean(domain));

  if (normalizedAllowedDomains.length === 0) {
    return ["'self'", 'https:'];
  }

  return [
    "'self'",
    ...new Set(
      [mainDomain, ...normalizedAllowedDomains]
        .filter((domain): domain is string => Boolean(domain))
        .flatMap((domain) => frameAncestorSourcesForDomain(domain))
    ),
  ];
}

export default clerkMiddleware(async (auth, req) => {
  // Intercept CORS preflight before Clerk auth runs.
  // Bearer token auth doesn't need credentials mode, so wildcard origin is safe.
  if (req.method === 'OPTIONS') {
    return new NextResponse(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }

  const response = NextResponse.next();

  if (req.nextUrl.pathname.startsWith('/book/')) {
    const frameAncestors = await getBookingFrameAncestors(req.nextUrl.pathname);
    response.headers.set(
      'Content-Security-Policy',
      `frame-ancestors ${frameAncestors.join(' ')};`
    );
  }

  if (!isPublicRoute(req)) {
    const authObj = await auth();
    if (!authObj.userId) {
      authObj.redirectToSignIn();
    }
  }

  return response;
});

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.png|.*\\.jpg|.*\\.jpeg|.*\\.gif|.*\\.svg).*)',
  ],
};
