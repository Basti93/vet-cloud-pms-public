import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import type { NextFetchEvent, NextRequest } from "next/server";

const isProtectedRoute = createRouteMatcher(["/dashboard(.*)"]);
const isPublicRoute = createRouteMatcher(["/", "/sign-in(.*)", "/access-denied"]);

const clerkProtectedProxy = clerkMiddleware(async (auth, req) => {
  await auth.protect();

  const { userId } = await auth();
  if (!userId) {
    return NextResponse.redirect(new URL("/sign-in", req.url));
  }

  const adminClerkIds =
    process.env.ADMIN_CLERK_IDS?.split(",").map((id) => id.trim()) || [];

  if (!adminClerkIds.includes(userId)) {
    return NextResponse.redirect(new URL("/access-denied", req.url));
  }
});

const clerkPublicProxy = clerkMiddleware();

// Clerk middleware (v6 and v7) sets x-middleware-rewrite to an https:// URL
// when running behind an HTTPS reverse proxy. The container itself runs plain
// HTTP, so Next.js following that rewrite hits EPROTO. Two cases to handle:
//
// 1. Self-rewrite (same path): Clerk is injecting auth state. Returning
//    NextResponse.next() lets Next.js render the route; auth() reads the
//    session from the cookie. Stripping the header would leave no
//    x-middleware-next and produce a blank page.
//
// 2. Different path on internal host: protocol mismatch only — rewrite the
//    URL to http: so Next.js can follow it within the container.
function fixInternalRewrite(res: Response | void, currentPath: string) {
  if (!res) return res;
  const rewrite = res.headers.get("x-middleware-rewrite");
  if (!rewrite) return res;

  const url = new URL(rewrite);
  const internalHosts = new Set(["localhost", "0.0.0.0", "[::]"]);
  const port = process.env.PORT || "3001";

  if (internalHosts.has(url.hostname) && url.pathname === currentPath) {
    // Self-rewrite: break the potential loop, render route normally.
    return NextResponse.next();
  }

  if (url.protocol === "https:" && internalHosts.has(url.hostname) && url.port === port) {
    url.protocol = "http:";
    res.headers.set("x-middleware-rewrite", url.toString());
  }

  return res;
}

export async function proxy(req: NextRequest, event: NextFetchEvent) {
  // Let the /api/health route handler respond directly.
  if (req.nextUrl.pathname === "/api/health") {
    return NextResponse.next();
  }

  // Guard against accidental document navigation to RSC/Flight URLs.
  if (req.nextUrl.searchParams.has("_rsc") && req.headers.get("rsc") !== "1") {
    const cleanUrl = req.nextUrl.clone();
    cleanUrl.searchParams.delete("_rsc");
    return NextResponse.redirect(cleanUrl);
  }

  if (isProtectedRoute(req)) {
    const res = await clerkProtectedProxy(req, event);
    return fixInternalRewrite(res, req.nextUrl.pathname);
  }

  // Run clerkMiddleware() for all remaining routes (including /api/trpc/*) so
  // that Clerk sets auth state headers. Route handlers that call auth() require
  // clerkMiddleware() to have run on the same request first.
  return fixInternalRewrite(
    await clerkPublicProxy(req, event),
    req.nextUrl.pathname,
  );
}

export const config = {
  matcher: [
    // Skip Next.js internals and all static files
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
