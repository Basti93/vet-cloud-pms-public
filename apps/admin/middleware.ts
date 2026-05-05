import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isProtectedRoute = createRouteMatcher([
  "/dashboard(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  // Guard against accidental document navigation to RSC/Flight URLs.
  // Internal Next.js RSC fetches include the `rsc: 1` header and should pass through.
  if (req.nextUrl.searchParams.has("_rsc") && req.headers.get("rsc") !== "1") {
    const cleanUrl = req.nextUrl.clone();
    cleanUrl.searchParams.delete("_rsc");
    return NextResponse.redirect(cleanUrl);
  }

  if (isProtectedRoute(req)) {
    await auth.protect();

    // Verify user is a system admin
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.redirect(new URL("/", req.url));
    }

    const adminClerkIds = process.env.ADMIN_CLERK_IDS?.split(",").map((id) =>
      id.trim()
    ) || [];

    if (!adminClerkIds.includes(userId)) {
      // Unauthorized: user is authenticated but not a system admin
      return NextResponse.redirect(new URL("/", req.url));
    }
  }

  const response = NextResponse.next();
  response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive, nosnippet");
  return response;
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
