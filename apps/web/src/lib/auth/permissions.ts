import { eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  users,
  roles,
  rolePermissions,
  userRoles,
} from "@/lib/db/schema";
import { DEFAULT_ROLE_DEFINITIONS, SYSTEM_ROLES_VERSION } from "@/lib/auth/roles";

export type Database = typeof db;

/**
 * Get all permissions for a user by looking up all assigned roles
 * and returning the UNION of their permissions.
 *
 * Algorithm:
 * 1. Find user by clerkId
 * 2. Get all roleIds from userRoles join table
 * 3. Get all permissions for those roleIds from rolePermissions
 * 4. Return deduplicated set of permissions
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

  // Step 3: Get all permissions from all assigned roles (UNION semantics)
  const roleIds = assignedRoles.map((r) => r.roleId);
  const perms = await db
    .select({ permission: rolePermissions.permission })
    .from(rolePermissions)
    .where(inArray(rolePermissions.roleId, roleIds));

  // Step 4: Return union of all permissions (Set deduplicates automatically)
  return new Set(perms.map((p) => p.permission));
}

export async function hasPermission(
  userId: string,
  permission: string
): Promise<boolean> {
  const perms = await getUserPermissions(userId);
  return perms.has(permission);
}

export async function createDefaultRoles(tenantId: string) {
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
    }
  }
}
