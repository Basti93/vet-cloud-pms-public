/**
 * Test script: Assign test roles to existing users
 *
 * This script assigns roles directly to users via the old users.roleId column
 * to simulate the state before the migration. It's useful for testing the
 * migrate-roles-to-join-table.ts script.
 *
 * Usage:
 *   npx tsx scripts/assign-test-roles.ts
 */

import { db } from "@/lib/db/client";
import { users, roles } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

async function assignTestRoles() {
  console.log("📋 Assigning test roles to existing users...\n");

  try {
    // Get all users and all roles
    const allUsers = await db.select().from(users);
    const allRoles = await db.select().from(roles);

    if (allUsers.length === 0) {
      console.log("❌ No users found in database");
      return;
    }

    if (allRoles.length === 0) {
      console.log("❌ No roles found in database");
      console.log("   Run: npx tsx scripts/init-default-roles.ts");
      return;
    }

    console.log(`Found ${allUsers.length} users and ${allRoles.length} roles\n`);

    // Assign roles:
    // - First user: Admin from their tenant
    // - Second user: Vet from their tenant
    // - Third user: Receptionist from their tenant
    const testAssignments = [
      { userIndex: 0, roleIndex: 0, label: "Admin" },      // Admin
      { userIndex: 1, roleIndex: 1, label: "Vet" },        // Vet
      { userIndex: 2, roleIndex: 2, label: "Receptionist" }, // Receptionist
    ];

    for (const assignment of testAssignments) {
      if (assignment.userIndex >= allUsers.length) {
        console.log(
          `⊘ Skipping ${assignment.label} (not enough users)`
        );
        continue;
      }

      const user = allUsers[assignment.userIndex];

      // Find a role from this user's tenant
      const roleForTenant = allRoles.find(r => r.tenantId === user.tenantId && r.name === assignment.label);

      if (!roleForTenant) {
        console.log(
          `⊘ No ${assignment.label} role found for tenant ${user.tenantId}`
        );
        continue;
      }

      // Update user.roleId
      const result = await db
        .update(users)
        .set({ roleId: roleForTenant.id })
        .where(eq(users.id, user.id))
        .returning();

      console.log(
        `✓ Assigned ${assignment.label} to ${user.email || user.id}`
      );
    }

    console.log("\n✅ Test roles assigned!");
    console.log("\nNow run the migration:");
    console.log("  npx tsx scripts/migrate-roles-to-join-table.ts");
  } catch (error) {
    console.error("❌ Assignment failed:", error);
    throw error;
  }
}

assignTestRoles();
