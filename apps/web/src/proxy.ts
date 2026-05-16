import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import type { NextFetchEvent, NextRequest } from 'next/server';
import { PUBLIC_ROUTES } from '@/config/routes';
import {
  frameAncestorSourcesForDomain,
  normalizeEmbeddingDomains,
} from '@/lib/booking/embed-origin';
import { db } from '@/lib/db/client';
import { tenants, websiteDomains, websiteProjects } from '@/lib/db/schema';
import { and, eq } from 'drizzle-orm';

const isPublicRoute = createRouteMatcher([...PUBLIC_ROUTES]);

function normalizeHost(host: string | null) {
  return (host ?? '').toLowerCase().replace(/^www\./, '').split(':')[0] ?? '';
}

function isPlatformHost(host: string) {
  const configured = normalizeHost(process.env.NEXT_PUBLIC_PLATFORM_DOMAIN ?? null);
  return (
    !host ||
    (!!configured && host === configured) ||
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host.endsWith('.localhost') ||
    // Private network ranges (dev proxy sets x-forwarded-host to LAN IP)
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host)
  );
}

type DomainCacheEntry = {
  result: { projectSlug: string; ownerTenantId: string | null; tenantSlug: string | null } | null;
  expiresAt: number;
};
const domainCache = new Map<string, DomainCacheEntry>();
const DOMAIN_CACHE_TTL_MS = 5 * 60 * 1000;
const DOMAIN_MISS_TTL_MS = 2 * 60 * 1000;

async function resolveWebsiteDomain(host: string) {
  const cached = domainCache.get(host);
  if (cached && cached.expiresAt > Date.now()) return cached.result;

  const [row] = await db
    .select({
      projectSlug: websiteProjects.slug,
      ownerTenantId: websiteProjects.ownerTenantId,
      tenantSlug: tenants.slug,
    })
    .from(websiteDomains)
    .innerJoin(websiteProjects, eq(websiteProjects.id, websiteDomains.websiteProjectId))
    .leftJoin(tenants, eq(tenants.id, websiteProjects.ownerTenantId))
    .where(and(eq(websiteDomains.domain, host), eq(websiteDomains.status, 'active')))
    .limit(1);

  const result = row ?? null;
  if (domainCache.size > 500) domainCache.clear();
  domainCache.set(host, {
    result,
    expiresAt: Date.now() + (result ? DOMAIN_CACHE_TTL_MS : DOMAIN_MISS_TTL_MS),
  });
  return result;
}

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

const clerkProtectedProxy = clerkMiddleware(async (auth, req) => {
  const authObj = await auth();
  if (!authObj.userId) {
    return authObj.redirectToSignIn();
  }
});
const clerkAuthStateProxy = clerkMiddleware();

export async function proxy(req: NextRequest, event: NextFetchEvent) {
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

  const host = normalizeHost(
    req.headers.get('x-forwarded-host') ?? req.headers.get('host')
  );
  const pathname = req.nextUrl.pathname;

  if (
    !isPlatformHost(host) &&
    !pathname.startsWith('/api') &&
    !pathname.startsWith('/_next')
  ) {
    try {
      const websiteDomain = await resolveWebsiteDomain(host);
      if (websiteDomain) {
        const url = req.nextUrl.clone();
        if (pathname === '/book' && websiteDomain.tenantSlug) {
          url.pathname = `/book/${websiteDomain.tenantSlug}`;
        } else {
          url.pathname = `/site/${websiteDomain.projectSlug}${pathname === '/' ? '' : pathname}`;
        }
        return NextResponse.rewrite(url);
      }
    } catch {
      // DB unavailable or unknown host — fall through to normal routing
    }
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
    if (pathname.startsWith('/api/trpc')) {
      return clerkAuthStateProxy(req, event);
    }

    return clerkProtectedProxy(req, event);
  }

  if (pathname.startsWith('/api/trpc')) {
    return clerkAuthStateProxy(req, event);
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.png|.*\\.jpg|.*\\.jpeg|.*\\.gif|.*\\.svg).*)',
  ],
};
