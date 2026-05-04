import { TRPCError } from "@trpc/server";
import { getUserPermissions } from "@/lib/auth/permissions";

/**
 * Middleware: require a specific permission
 * Throws FORBIDDEN if user lacks the permission
 *
 * CACHING STRATEGY:
 * - First call in request: fetch all permissions, cache in ctx.permissionCache
 * - Subsequent calls: use cached Set (no DB queries)
 * - Benefits from role-based cache (getRolePermissions) for initial fetch
 *
 * Performance impact:
 * - Single permission check: 1 query (user lookup) + cached roles
 * - Multiple checks same request: 1 query (first check) + 0 queries (rest use cache)
 * - vs. without cache: N queries for N permission checks
 */
export function requirePermission(permission: string) {
  // tRPC middleware context/result typing varies by procedure builder;
  // keep this generic to remain compatible across all routers.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return async ({ ctx, next }: any) => {
    if (!ctx.userId) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "User not authenticated",
      });
    }

    // Get permission set for this user, using in-request cache if available
    let permissionSet: Set<string>;
    if (ctx.permissionCache) {
      // Cache hit: use cached permission set
      permissionSet = ctx.permissionCache;
    } else {
      // Cache miss: fetch from DB (leveraging role-based cache), then store in context
      permissionSet = await getUserPermissions(ctx.userId);
      ctx.permissionCache = permissionSet;
    }

    // Check if user has the required permission
    const allowed = permissionSet.has(permission);
    if (!allowed) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: `Missing permission: ${permission}`,
      });
    }

    return next();
  };
}
