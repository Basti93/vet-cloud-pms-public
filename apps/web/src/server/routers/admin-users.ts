import { z } from "zod";
import { createAdminRouter, procedure } from "../adminTrpc";
import { db } from "@/lib/db/client";
import { users, userRoles, roles } from "@/lib/db/schema";
import { eq, inArray } from "drizzle-orm";

export const adminUsersRouter = createAdminRouter({
  /**
   * Get all users in a specific tenant with their roles
   */
  listTenantUsers: procedure
    .input(z.object({ tenantId: z.string().uuid() }))
    .query(async ({ input }) => {
      const tenantUsers = await db
        .select({
          id: users.id,
          clerkId: users.clerkId,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
          createdAt: users.createdAt,
        })
        .from(users)
        .where(eq(users.tenantId, input.tenantId));

      // Get roles for each user
      const usersWithRoles = await Promise.all(
        tenantUsers.map(async (user) => {
          const userRoleAssignments = await db
            .select({ roleId: userRoles.roleId })
            .from(userRoles)
            .where(eq(userRoles.userId, user.id));

          const roleIds = userRoleAssignments.map((ur) => ur.roleId);
          let roleNames: string[] = [];

          if (roleIds.length > 0) {
            const roleRecords = await db
              .select({ name: roles.name })
              .from(roles)
              .where(inArray(roles.id, roleIds));

            roleNames = roleRecords.map((r) => r.name);
          }

          return {
            ...user,
            roles: roleNames,
          };
        })
      );

      return usersWithRoles;
    }),
});
