import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  users,
  roles,
  rolePermissions,
  userRoles,
} from "@/lib/db/schema";
import { DEFAULT_ROLE_DEFINITIONS, SYSTEM_ROLES_VERSION } from "@/lib/auth/roles";
import { getRolePermissions, invalidateAllRolePermissions } from "@/lib/auth/permission-cache";

export type Database = typeof db;

/**
 * Get all permissions for a user by looking up all assigned roles
 * and returning the UNION of their permissions.
 *
 * OPTIMIZED ALGORITHM:
 * 1. Find user by clerkId (1 DB query)
 * 2. Get all roleIds from userRoles join table (included in step 1, or separate)
 * 3. For each roleId: Call getRolePermissions(roleId)
 *    - Cache hit: instant Set from memory
 *    - Cache miss: 1 DB query, then cached for future requests
 * 4. Merge all role permissions into single Set (in-memory)
 * 5. Return deduplicated set
 *
 * PERFORMANCE:
 * - Cold cache: 1 query (user lookup) + N queries (one per role with cache miss)
 * - Warm cache: 1 query (user lookup) + 0 queries (all roles cached)
 * - Within-request: caller should cache result in ctx.permissionCache
 */
export async function getUserPermissions(userId: string): Promise<Set<string>> {
  // Step 1: Find user by clerkId
  const [user] = await db
    .select({ id: users.id, tenantId: users.tenantId })
    .from(users)
    .where(eq(users.clerkId, userId))
    .limit(1);

  if (!user) {
    return new Set(); // User not found
  }

  // Step 2: Get all roleIds assigned to this user
  const assignedRoles = await db
    .select({ roleId: userRoles.roleId })
    .from(userRoles)
    .where(eq(userRoles.userId, user.id));

  if (assignedRoles.length === 0) {
    return new Set(); // No roles assigned
  }

  // Step 3 & 4: Merge permissions from all roles using cached lookups
  const allPermissions = new Set<string>();
  const roleIds = assignedRoles.map((r) => r.roleId);

  for (const roleId of roleIds) {
    const rolePerms = await getRolePermissions(roleId);
    rolePerms.forEach((perm) => allPermissions.add(perm));
  }

  return allPermissions;
}

/**
 * Check if a user has a specific permission.
 *
 * NOTE: This function calls getUserPermissions() which leverages:
 * - In-request caching via tRPC context (set by requirePermission middleware)
 * - Role-based caching via getRolePermissions()
 *
 * @param userId - The Clerk user ID to check
 * @param permission - The permission string to verify
 * @returns true if user has this permission, false otherwise
 */
export async function hasPermission(
  userId: string,
  permission: string
): Promise<boolean> {
  const perms = await getUserPermissions(userId);
  return perms.has(permission);
}

export async function createDefaultRoles(tenantId: string) {
  // Flag to track if any roles were modified (to invalidate cache only once)
  let cacheNeedsInvalidation = false;

  for (const role of DEFAULT_ROLE_DEFINITIONS) {
    const [createdOrExisting] = await db
      .insert(roles)
      .values({
        tenantId,
        code: role.code,
        name: role.name,
        description: role.description,
        isSystem: role.isSystem,
        baseVersion: role.baseVersion,
      })
      .onConflictDoUpdate({
        target: [roles.tenantId, roles.code],
        set: {
          name: role.name,
          description: role.description,
          isSystem: true,
          baseVersion: SYSTEM_ROLES_VERSION,
        },
      })
      .returning({
        id: roles.id,
        isEditableByTenant: roles.isEditableByTenant,
      });

    if (!createdOrExisting) continue;

    // For locked system roles, enforce canonical permissions from code defaults.
    if (!createdOrExisting.isEditableByTenant) {
      await db
        .delete(rolePermissions)
        .where(eq(rolePermissions.roleId, createdOrExisting.id));
      for (const perm of role.permissions) {
        await db
          .insert(rolePermissions)
          .values({
            roleId: createdOrExisting.id,
            permission: perm,
          })
          .onConflictDoNothing();
      }
      cacheNeedsInvalidation = true;
    } else {
      // For tenant-editable roles, only ensure baseline permissions are present.
      for (const perm of role.permissions) {
        await db
          .insert(rolePermissions)
          .values({
            roleId: createdOrExisting.id,
            permission: perm,
          })
          .onConflictDoNothing();
      }
      cacheNeedsInvalidation = true;
    }
  }

  // Invalidate all cached role permissions since system roles were reconfigured
  if (cacheNeedsInvalidation) {
    invalidateAllRolePermissions();
  }
}
