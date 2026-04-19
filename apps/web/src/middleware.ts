import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const practiceSlug = pathname.split('/')[1];

  if (pathname === '/' || !practiceSlug || pathname.startsWith('/dashboard') || pathname.startsWith('/sign')) {
    return NextResponse.next();
  }

  const response = NextResponse.next();
  response.cookies.set('practice_slug', practiceSlug, { path: '/' });
  return response;
}

export const config = {
  matcher: ['/((?!_next|static|public|api).*)'],
};
