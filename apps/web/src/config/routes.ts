/**
 * Public routes — accessible without a Clerk session.
 * Auth for these routes is handled at the procedure or token level.
 */
export const PUBLIC_ROUTES = [
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/invite/accept(.*)',
  '/book(.*)',          // Online booking pages
  '/impressum(.*)',     // Legal notice
  '/datenschutz(.*)',   // Privacy policy
  '/api/webhooks/clerk',
  '/api/trpc/booking(.*)',        // publicBookingProcedure
  '/api/trpc/tenant(.*)',         // publicProcedure
  '/api/trpc/adminDashboard(.*)', // adminProcedure + ADMIN_CLERK_IDS
  '/api/calendar(.*)',            // JWT-protected
  '/',
] as const;
