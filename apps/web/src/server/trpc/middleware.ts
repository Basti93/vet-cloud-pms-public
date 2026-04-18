import { TRPCError } from "@trpc/server";
import { hasPermission } from "@/lib/auth/permissions";

/**
 * Middleware: require a specific permission
 * Throws FORBIDDEN if user lacks the permission
 */
export function requirePermission(permission: string) {
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
