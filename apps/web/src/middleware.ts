import { clerkMiddleware } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';

export default clerkMiddleware(async (auth, request: NextRequest) => {
  const pathname = request.nextUrl.pathname;

  // Only capture practice slug from /[practiceSlug] routes (single segment after root)
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length === 1 && !segments[0].startsWith('.')) {
    const practiceSlug = segments[0];
    const response = NextResponse.next();
    response.cookies.set('practice_slug', practiceSlug, { path: '/' });
    return response;
  }

  return NextResponse.next();
});

export const config = {
  matcher: ['/((?!_next|static|public|api).*)'],
};
