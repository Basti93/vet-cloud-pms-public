import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import type { NextFetchEvent, NextRequest } from "next/server";

const isProtectedRoute = createRouteMatcher([
  "/dashboard(.*)",
]);

const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/access-denied",
]);

const clerkProtectedProxy = clerkMiddleware(async (auth, req) => {
  await auth.protect();

  // Verify user is a system admin
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.redirect(new URL("/sign-in", req.url));
  }

  const adminClerkIds = process.env.ADMIN_CLERK_IDS?.split(",").map((id) =>
    id.trim()
  ) || [];

  if (!adminClerkIds.includes(userId)) {
    // Redirect to a static page that is NOT behind auth.
    // /sign-in loops because Clerk auto-redirects already-signed-in users
    // back to "/", and "/" sends authenticated users to /dashboard again.
    return NextResponse.redirect(new URL("/access-denied", req.url));
  }
});
const clerkAuthStateProxy = clerkMiddleware();

function keepInternalRewriteHttp(res: Response | void, currentPath: string) {
  if (!res) return res;
  const rewrite = res.headers.get("x-middleware-rewrite");
  if (!rewrite) return res;

  const url = new URL(rewrite);
  const internalHosts = new Set(["localhost", "0.0.0.0", "[::]"]);
  const port = process.env.PORT || "3001";

  // Self-rewrite to same path = infinite loop. Strip the header instead.
  if (internalHosts.has(url.hostname) && url.pathname === currentPath) {
    res.headers.delete("x-middleware-rewrite");
    return res;
  }

  if (url.protocol === "https:" && internalHosts.has(url.hostname) && url.port === port) {
    url.protocol = "http:";
    res.headers.set("x-middleware-rewrite", url.toString());
  }

  return res;
}

const requestCounts = new Map<string, number>();
const requestTimestamps = new Map<string, number[]>();
const LOOP_WINDOW_MS = 500;
const LOOP_THRESHOLD = 8;

function trackRequest(key: string): { count: number; isLooping: boolean } {
  const count = (requestCounts.get(key) ?? 0) + 1;
  requestCounts.set(key, count);

  const now = Date.now();
  const prev = (requestTimestamps.get(key) ?? []).filter(t => now - t < LOOP_WINDOW_MS);
  prev.push(now);
  requestTimestamps.set(key, prev);

  return { count, isLooping: prev.length > LOOP_THRESHOLD };
}

export async function proxy(req: NextRequest, event: NextFetchEvent) {
  const key = `${req.method} ${req.nextUrl.pathname}`;
  const { count, isLooping } = trackRequest(key);

  console.log(`[proxy] #${count} ${key} | rsc=${req.headers.get("rsc")} | _rsc=${req.nextUrl.searchParams.get("_rsc")} | subreq=${req.headers.get("x-middleware-subrequest")} | referer=${req.headers.get("referer")}`);

  if (isLooping) {
    console.error(`[proxy] LOOP DETECTED: ${key} called ${count} times (${LOOP_THRESHOLD}+ hits in ${LOOP_WINDOW_MS}ms)`);
    return new NextResponse("Loop Detected", { status: 508 });
  }

  if (req.nextUrl.pathname === "/api/health") {
    return NextResponse.next();
  }

  // Guard against accidental document navigation to RSC/Flight URLs.
  // Internal Next.js RSC fetches include the `rsc: 1` header and should pass through.
  if (req.nextUrl.searchParams.has("_rsc") && req.headers.get("rsc") !== "1") {
    const cleanUrl = req.nextUrl.clone();
    cleanUrl.searchParams.delete("_rsc");
    console.log(`[proxy] stripping _rsc, redirecting to ${cleanUrl.pathname}`);
    return NextResponse.redirect(cleanUrl);
  }

  if (isProtectedRoute(req)) {
    const res = await clerkProtectedProxy(req, event);
    const rewrite = (res as Response | null)?.headers?.get("x-middleware-rewrite");
    if (rewrite) console.log(`[proxy] protected rewrite → ${rewrite}`);
    return keepInternalRewriteHttp(res, req.nextUrl.pathname);
  }

  return isPublicRoute(req)
    ? keepInternalRewriteHttp(await clerkAuthStateProxy(req, event), req.nextUrl.pathname)
    : NextResponse.next();
}

export const config = {
  matcher: [
    // Skip Next.js internals and all static files
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
