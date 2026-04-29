import { eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  users,
  roles,
  rolePermissions,
  userRoles,
  PERMISSIONS,
} from "@/lib/db/schema";

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
    .select({ id: users.id })
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
  const defaultRoles = [
    {
      name: "Admin",
      description: "Full access",
      permissions: Object.values(PERMISSIONS),
      isSystem: true,
    },
    {
      name: "Vet",
      description: "Medical access + appointments + patients",
      permissions: [
        PERMISSIONS.MEDICAL_READ,
        PERMISSIONS.MEDICAL_CREATE,
        PERMISSIONS.MEDICAL_UPDATE,
        PERMISSIONS.APPOINTMENTS_READ,
        PERMISSIONS.APPOINTMENTS_UPDATE,
        PERMISSIONS.PATIENTS_READ,
        PERMISSIONS.PATIENTS_CREATE,
        PERMISSIONS.PATIENTS_UPDATE,
      ],
      isSystem: true,
    },
    {
      name: "Receptionist",
      description: "Appointments + patient data",
      permissions: [
        PERMISSIONS.APPOINTMENTS_READ,
        PERMISSIONS.APPOINTMENTS_CREATE,
        PERMISSIONS.APPOINTMENTS_CANCEL,
        PERMISSIONS.PATIENTS_READ,
        PERMISSIONS.PATIENTS_CREATE,
        PERMISSIONS.PATIENTS_UPDATE,
      ],
      isSystem: true,
    },
  ];

  for (const role of defaultRoles) {
    const [created] = await db
      .insert(roles)
      .values({
        tenantId,
        name: role.name,
        description: role.description,
        isSystem: role.isSystem,
      })
      .onConflictDoNothing()
      .returning();

    if (!created) {
      continue;
    }

    for (const perm of role.permissions) {
      await db
        .insert(rolePermissions)
        .values({
          roleId: created.id,
          permission: perm,
        })
        .onConflictDoNothing();
    }
  }
}
