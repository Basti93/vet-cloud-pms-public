import { initTRPC, TRPCError } from "@trpc/server";
import { auth } from "@clerk/nextjs/server";
import superjson from "superjson";
import { ZodError } from "zod";
import { db } from "@/lib/db/client";
import { checkRateLimit, getRateLimitInfo } from "@/lib/rateLimit";

// ============================================================================
// Context
// ============================================================================

export async function createTRPCContext(opts: { headers: Headers }) {
  const { userId } = await auth();

  return {
    db,
    userId,
    headers: opts.headers,
  };
}

export type TRPCContext = Awaited<ReturnType<typeof createTRPCContext>>;

// ============================================================================
// tRPC Init
// ============================================================================

const t = initTRPC.context<TRPCContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

// ============================================================================
// Middleware
// ============================================================================

const timingMiddleware = t.middleware(async ({ next, path }) => {
  const start = Date.now();
  const result = await next();
  const durationMs = Date.now() - start;
  console.log(`[tRPC] ${path} took ${durationMs}ms`);
  return result;
});

const enforceUserIsAuthenticated = t.middleware(({ ctx, next }) => {
  if (!ctx.userId) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({ ctx: { ...ctx, userId: ctx.userId } });
});

const enforceIsAdmin = t.middleware(({ ctx, next }) => {
  if (!ctx.userId) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }

  // Check if user is in ADMIN_CLERK_IDS list
  const allowedIds = (process.env.ADMIN_CLERK_IDS ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);

  if (!allowedIds.includes(ctx.userId)) {
    throw new TRPCError({ code: "FORBIDDEN" });
  }

  return next({ ctx: { ...ctx, userId: ctx.userId } });
});

// ✅ Rate limiting: 100 requests per 60 seconds per user/IP
const rateLimitMiddleware = t.middleware(({ ctx, next }) => {
  // Use userId if authenticated, otherwise fall back to IP
  const identifier = ctx.userId || ctx.headers.get("x-forwarded-for") || "unknown";

  if (!checkRateLimit(identifier, false)) {
    const info = getRateLimitInfo(identifier, false);
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: `Rate limit exceeded. Reset at ${new Date(info.resetAt).toISOString()}`,
    });
  }

  return next();
});

// ✅ Stricter rate limiting for public booking: 20 requests per 60 seconds per IP
const publicBookingRateLimitMiddleware = t.middleware(({ ctx, next }) => {
  // Use IP only for public booking endpoints (no userId since they're unauthenticated)
  const identifier = ctx.headers.get("x-forwarded-for") || "unknown";

  if (!checkRateLimit(identifier, true)) {
    const info = getRateLimitInfo(identifier, true);
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: `Rate limit exceeded. Reset at ${new Date(info.resetAt).toISOString()}`,
    });
  }

  return next();
});

// ============================================================================
// Exports
// ============================================================================

export const createTRPCRouter = t.router;
export const createCallerFactory = t.createCallerFactory;

/** Public procedure — no auth required */
export const publicProcedure = t.procedure
  .use(rateLimitMiddleware)
  .use(timingMiddleware);

/** Public booking procedure — stricter rate limit (20 req/60s) for public booking endpoints */
export const publicBookingProcedure = t.procedure
  .use(publicBookingRateLimitMiddleware)
  .use(timingMiddleware);

/** Protected procedure — requires Clerk session */
export const protectedProcedure = t.procedure
  .use(rateLimitMiddleware)
  .use(timingMiddleware)
  .use(enforceUserIsAuthenticated);

/** Admin procedure — requires Clerk session + ADMIN_CLERK_IDS env var */
export const adminProcedure = t.procedure
  .use(rateLimitMiddleware)
  .use(timingMiddleware)
  .use(enforceIsAdmin);
