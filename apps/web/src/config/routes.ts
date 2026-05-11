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
  '/api/webhooks/stripe',
  '/api/trpc/booking(.*)',        // publicBookingProcedure
  '/api/trpc/tenant(.*)',         // publicProcedure
  '/api/trpc/adminDashboard(.*)', // adminProcedure + ADMIN_CLERK_IDS
  '/api/cron/send-reminders',     // CRON_SECRET-protected scheduled job
  '/api/cron/reset-demo',         // CRON_SECRET-protected demo reset job
  '/api/unsubscribe',             // token-protected unsubscribe link from emails
  '/api/calendar(.*)',            // JWT-protected
  '/api/admin(.*)',               // Bearer-token protected (ADMIN_API_TOKEN)
  '/',
] as const;
