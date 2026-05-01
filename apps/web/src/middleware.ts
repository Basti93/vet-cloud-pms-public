import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { PUBLIC_ROUTES } from '@/config/routes';

const isPublicRoute = createRouteMatcher([...PUBLIC_ROUTES]);

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

  if (!isPublicRoute(req)) {
    const authObj = await auth();
    if (!authObj.userId) {
      authObj.redirectToSignIn();
    }
  }
});

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.png|.*\\.jpg|.*\\.jpeg|.*\\.gif|.*\\.svg).*)',
  ],
};
