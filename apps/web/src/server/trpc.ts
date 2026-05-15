import { initTRPC, TRPCError } from "@trpc/server";
import { auth } from "@clerk/nextjs/server";
import superjson from "superjson";
import { ZodError } from "zod";
import { adminDb, db } from "@/lib/db/client";
import { tenantDeletionSchedules, users, tenants } from "@/lib/db/schema";
import { and, eq, isNotNull } from "drizzle-orm";
import { checkRateLimit, getRateLimitInfo } from "@/lib/rateLimit";
import { logEvent, logEventAsync } from "./trpc/logging-middleware";

// ============================================================================
// Context
// ============================================================================

export async function createTRPCContext(opts: { headers: Headers }) {
  const { userId } = await auth();

  return {
    db,
    adminDb,
    userId,
    headers: opts.headers,
    permissionCache: undefined,
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

const DEACTIVATION_ALLOWED_PATHS = new Set([
  "tenant.getDeletionStatus",
  "tenant.getCurrent",
  "tenant.requestDeletion",
  "subscriptions.getSubscriptionStatus",
  "subscriptions.cancelSubscription",
  "subscriptions.reactivateSubscription",
  "subscriptions.undoCancellation",
  "admin.getCurrentUser",
  "admin.getUserPermissions",
  "admin.getSeatInfo",
  "admin.listUsers",
  "admin.toggleUserActive",
]);

const INACTIVE_USER_ALLOWED_PATHS = new Set([
  "admin.getCurrentUser",
  "admin.getUserPermissions",
]);

const enforceTenantIsActive = t.middleware(async ({ ctx, path, next }) => {
  if (!ctx.userId) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }

  const [user] = await ctx.db
    .select({ id: users.id, tenantId: users.tenantId, active: users.active })
    .from(users)
    .where(eq(users.clerkId, ctx.userId))
    .limit(1);

  if (!user?.tenantId) {
    throw new TRPCError({ code: "FORBIDDEN" });
  }

  if (!user.active && !INACTIVE_USER_ALLOWED_PATHS.has(path)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "USER_INACTIVE",
    });
  }

  const [scheduledDeletion] = await ctx.db
    .select({ id: tenantDeletionSchedules.id })
    .from(tenantDeletionSchedules)
    .where(
      and(
        eq(tenantDeletionSchedules.tenantId, user.tenantId),
        eq(tenantDeletionSchedules.status, "scheduled")
      )
    )
    .limit(1);

  const [tenantData] = await ctx.db
    .select({ deactivatedAt: tenants.deactivatedAt })
    .from(tenants)
    .where(eq(tenants.id, user.tenantId))
    .limit(1);

  const isDeactivated = scheduledDeletion || tenantData?.deactivatedAt;

  if (isDeactivated && !DEACTIVATION_ALLOWED_PATHS.has(path)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "TENANT_DEACTIVATED",
    });
  }

  // Inject resolved tenant into context so downstream procedures and middlewares
  // can use ctx.tenantId / ctx.dbUserId without repeating the DB lookup.
  // Only pass the new fields — tRPC merges them with existing ctx (including
  // the userId: string narrowing from enforceUserIsAuthenticated).
  return next({ ctx: { tenantId: user.tenantId, dbUserId: user.id } });
});

// Validates that input.tenantId (when present) matches the authenticated user's
// tenant. Logs the attempt as a security event and throws FORBIDDEN on mismatch.
const enforceTenantOwnership = t.middleware(async ({ ctx, getRawInput, path, next }) => {
  const rawInput = await getRawInput();
  if (rawInput !== null && typeof rawInput === "object" && !Array.isArray(rawInput)) {
    const inputTenantId = (rawInput as Record<string, unknown>).tenantId;
    if (typeof inputTenantId === "string") {
      // tenantId is injected by enforceTenantIsActive which runs before this
      const { tenantId, dbUserId } = ctx as { tenantId?: string; dbUserId?: string };
      if (tenantId && inputTenantId !== tenantId) {
        logEventAsync({
          level: "warn",
          category: "security",
          eventType: "tenant_ownership_violation",
          message: `Cross-tenant access attempt blocked: ${path}`,
          tenantId,
          userId: dbUserId,
          metadata: { path, attemptedTenantId: inputTenantId },
          ipAddress: ctx.headers.get("x-forwarded-for") ?? undefined,
        });
        throw new TRPCError({ code: "FORBIDDEN" });
      }
    }
  }
  return next();
});

const enforceIsAdmin = t.middleware(({ ctx, next }) => {
  if (!ctx.userId) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }

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

const SLOW_REQUEST_THRESHOLD_MS = 2000;

const systemLoggingMiddleware = t.middleware(async ({ ctx, path, type, next }) => {
  const start = Date.now();
  const isAdminProxy = ctx.headers.get("x-admin-proxy") === "1";
  const requestId = ctx.headers.get("x-request-id") ?? undefined;
  const ipAddress = ctx.headers.get("x-forwarded-for") ?? undefined;

  const resolveUserContext = async () => {
    if (!ctx.userId) return { tenantId: undefined, userId: undefined };

    const [user] = await ctx.db
      .select({ id: users.id, tenantId: users.tenantId })
      .from(users)
      .where(eq(users.clerkId, ctx.userId))
      .limit(1);

    return {
      tenantId: user?.tenantId ?? undefined,
      userId: user?.id ?? undefined,
    };
  };

  try {
    const result = await next();
    const durationMs = Date.now() - start;

    // Only log web-app traffic, never admin-proxied requests
    if (!isAdminProxy && durationMs > SLOW_REQUEST_THRESHOLD_MS) {
      const actor = await resolveUserContext();
      logEventAsync({
        level: "warn",
        category: "api",
        eventType: "slow_request",
        message: `Slow ${type} request: ${path}`,
        metadata: { path, type, durationMs },
        tenantId: actor.tenantId,
        userId: actor.userId,
        correlationId: requestId,
        ipAddress,
      });
    }

    return result;
  } catch (error) {
    const durationMs = Date.now() - start;

    if (!isAdminProxy) {
      const isTRPCError = error instanceof TRPCError;
      const code = isTRPCError ? error.code : "INTERNAL_SERVER_ERROR";
      const message = error instanceof Error ? error.message : String(error);
      const stack = error instanceof Error ? error.stack : undefined;
      const actor = await resolveUserContext();

      await logEvent({
        level: code === "UNAUTHORIZED" || code === "FORBIDDEN" ? "warn" : code === "NOT_FOUND" ? "info" : "error",
        category: "api",
        eventType: `request_failed_${code}`,
        message: `${type} request failed: ${path}`,
        metadata: {
          path,
          type,
          code,
          durationMs,
          errorMessage: message,
        },
        errorStack: stack,
        tenantId: actor.tenantId,
        userId: actor.userId,
        correlationId: requestId,
        ipAddress,
      });
    }

    throw error;
  }
});

// ============================================================================
// Exports
// ============================================================================

export const createTRPCRouter = t.router;
export const createCallerFactory = t.createCallerFactory;

/** Public procedure — no auth required */
export const publicProcedure = t.procedure
  .use(systemLoggingMiddleware)
  .use(rateLimitMiddleware)
  .use(timingMiddleware);

/** Public booking procedure — stricter rate limit (20 req/60s) for public booking endpoints */
export const publicBookingProcedure = t.procedure
  .use(systemLoggingMiddleware)
  .use(publicBookingRateLimitMiddleware)
  .use(timingMiddleware);

/** Protected procedure — requires Clerk session */
export const protectedProcedure = t.procedure
  .use(systemLoggingMiddleware)
  .use(rateLimitMiddleware)
  .use(timingMiddleware)
  .use(enforceUserIsAuthenticated)
  .use(enforceTenantIsActive);

/**
 * Tenant-scoped procedure — extends protectedProcedure.
 * Use for any procedure that accepts a tenantId in its input.
 * Automatically validates input.tenantId === ctx.tenantId and logs
 * cross-tenant access attempts as security events.
 */
export const tenantProcedure = t.procedure
  .use(systemLoggingMiddleware)
  .use(rateLimitMiddleware)
  .use(timingMiddleware)
  .use(enforceUserIsAuthenticated)
  .use(enforceTenantIsActive)
  .use(enforceTenantOwnership);

/** Admin procedure — requires Clerk session + ADMIN_CLERK_IDS env var */
export const adminProcedure = t.procedure
  .use(({ ctx, next }) => next({ ctx: { ...ctx, db: ctx.adminDb } }))
  .use(rateLimitMiddleware)
  .use(timingMiddleware)
  .use(enforceIsAdmin);
