import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  users,
  roles,
  rolePermissions,
  PERMISSIONS,
} from "@/lib/db/schema";

export type Database = typeof db;

export async function getUserPermissions(userId: string): Promise<Set<string>> {
  const [user] = await db
    .select({ roleId: users.roleId })
    .from(users)
    .where(eq(users.clerkId, userId))
    .limit(1);

  if (!user?.roleId) {
    return new Set();
  }

  const perms = await db
    .select({ permission: rolePermissions.permission })
    .from(rolePermissions)
    .where(eq(rolePermissions.roleId, user.roleId));

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
