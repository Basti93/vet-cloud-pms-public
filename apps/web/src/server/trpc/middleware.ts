import { TRPCError } from "@trpc/server";
import { hasPermission } from "@/lib/auth/permissions";

/**
 * Middleware: require a specific permission
 * Throws FORBIDDEN if user lacks the permission
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

    const allowed = await hasPermission(ctx.userId, permission);
    if (!allowed) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: `Missing permission: ${permission}`,
      });
    }

    return next();
  };
}
