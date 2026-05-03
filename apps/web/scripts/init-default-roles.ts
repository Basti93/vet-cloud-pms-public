/**
 * Initialize default roles for all tenants
 *
 * This script creates the system roles (Admin, Vet, Receptionist) for each tenant
 * in the database. Run this once after deploying the userRoles schema migration.
 *
 * Usage:
 *   npx tsx scripts/init-default-roles.ts
 */

import { db } from "@/lib/db/client";
import { tenants, roles, rolePermissions } from "@/lib/db/schema";
import { DEFAULT_ROLE_DEFINITIONS } from "@/lib/auth/roles";

async function initDefaultRoles() {
  console.log("🔄 Initializing default roles for all tenants...\n");

  try {
    // Get all tenants
    const allTenants = await db.select().from(tenants);
    console.log(`Found ${allTenants.length} tenant(s)\n`);

    let rolesCreated = 0;
    let tenantsProcessed = 0;

    for (const tenant of allTenants) {
      console.log(`📍 Processing tenant: ${tenant.name} (${tenant.id})`);

      for (const roleTemplate of DEFAULT_ROLE_DEFINITIONS) {
        // Insert role
        const [createdRole] = await db
          .insert(roles)
          .values({
            tenantId: tenant.id,
            code: roleTemplate.code,
            name: roleTemplate.name,
            description: roleTemplate.description,
            isSystem: roleTemplate.isSystem,
          })
          .onConflictDoNothing()
          .returning();

        if (createdRole) {
          console.log(`  ✓ Created role: ${roleTemplate.name}`);
          rolesCreated++;

          // Insert permissions for this role
          for (const permission of roleTemplate.permissions) {
            await db
              .insert(rolePermissions)
              .values({
                roleId: createdRole.id,
                permission,
              })
              .onConflictDoNothing();
          }
        } else {
          console.log(`  ⊘ Role already exists: ${roleTemplate.name}`);
        }
      }

      tenantsProcessed++;
      console.log("");
    }

    console.log("✅ Initialization complete!");
    console.log(`  Tenants processed: ${tenantsProcessed}`);
    console.log(`  Roles created: ${rolesCreated}`);
  } catch (error) {
    console.error("❌ Initialization failed:", error);
    throw error;
  }
}

initDefaultRoles();
