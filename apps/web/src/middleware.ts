import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

// Routes that don't require authentication
const isPublicRoute = createRouteMatcher([
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/book(.*)',  // Public booking pages
  '/api/webhooks/clerk',  // Clerk webhooks (use Svix signature verification)
  '/',
]);

export default clerkMiddleware(async (auth, req) => {
  // Protect non-public routes by redirecting to sign-in if not authenticated
  if (!isPublicRoute(req)) {
    const authObj = await auth();
    if (!authObj.userId) {
      authObj.redirectToSignIn();
    }
  }
});

export const config = {
  matcher: [
    // Match all routes except static files and Next.js internals
    '/((?!_next/static|_next/image|favicon.ico|.*\\.png|.*\\.jpg|.*\\.jpeg|.*\\.gif|.*\\.svg).*)',
  ],
};
