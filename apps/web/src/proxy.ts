import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { PUBLIC_ROUTES } from '@/config/routes';
import {
  frameAncestorSourcesForDomain,
  normalizeEmbeddingDomains,
} from '@/lib/booking/embed-origin';
import { db } from '@/lib/db/client';
import { tenants } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

const isPublicRoute = createRouteMatcher([...PUBLIC_ROUTES]);

async function getBookingFrameAncestors(pathname: string) {
  const tenantSlug = pathname.split('/')[2];
  if (!tenantSlug) return ["'self'"];

  const [tenant] = await db
    .select({ allowedEmbeddingDomains: tenants.allowedEmbeddingDomains })
    .from(tenants)
    .where(eq(tenants.slug, tenantSlug))
    .limit(1);

  const normalizedAllowedDomains = normalizeEmbeddingDomains(
    (tenant?.allowedEmbeddingDomains as string[] | null) || []
  );

  if (normalizedAllowedDomains.length === 0) {
    return ["'self'"];
  }

  return [
    "'self'",
    ...new Set(
      normalizedAllowedDomains.flatMap((domain) =>
        frameAncestorSourcesForDomain(domain)
      )
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
