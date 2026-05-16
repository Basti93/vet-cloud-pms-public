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

export async function proxy(req: NextRequest, event: NextFetchEvent) {
  // Guard against accidental document navigation to RSC/Flight URLs.
  // Internal Next.js RSC fetches include the `rsc: 1` header and should pass through.
  if (req.nextUrl.searchParams.has("_rsc") && req.headers.get("rsc") !== "1") {
    const cleanUrl = req.nextUrl.clone();
    cleanUrl.searchParams.delete("_rsc");
    return NextResponse.redirect(cleanUrl);
  }

  if (isProtectedRoute(req)) {
    return clerkProtectedProxy(req, event);
  }

  return isPublicRoute(req) ? clerkAuthStateProxy(req, event) : NextResponse.next();
}

export const config = {
  matcher: [
    // Skip Next.js internals and all static files
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
