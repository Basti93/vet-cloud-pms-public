import { clerkMiddleware } from '@clerk/nextjs/server';

export default clerkMiddleware();

export const config = {
  matcher: [
    // Exclude static files and _next routes, but include everything else
    '/((?!_next|.*\\..*|static|public).*)',
  ],
};
