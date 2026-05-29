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
    return clerkProtectedProxy(req, event);
  }

  // Run clerkMiddleware() for all remaining routes (including /api/trpc/*) so
  // that Clerk sets auth state headers. Route handlers that call auth() require
  // clerkMiddleware() to have run on the same request first.
  return clerkPublicProxy(req, event);
}

export const config = {
  matcher: [
    // Skip Next.js internals and all static files
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
