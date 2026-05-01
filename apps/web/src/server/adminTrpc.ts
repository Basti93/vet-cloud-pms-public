import { adminProcedure, createTRPCRouter } from "./trpc";

/**
 * Scoped tRPC exports for admin routers.
 *
 * Only `procedure` (= adminProcedure) and `createAdminRouter` are exported.
 * publicProcedure and protectedProcedure are intentionally unavailable here,
 * so every endpoint in an admin router is automatically protected.
 */
export const createAdminRouter = createTRPCRouter;
export const procedure = adminProcedure;
