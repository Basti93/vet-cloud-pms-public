import { db } from "@/lib/db/client";
import { users, userRoles } from "@/lib/db/schema";
import { eq, isNotNull } from "drizzle-orm";

/**
 * Migration script: Migrate users.roleId → userRoles join table
 *
 * This script transfers existing single-role assignments from the deprecated
 * users.roleId column into the new many-to-many userRoles join table.
 *
 * Run after deploying the schema migration that adds the userRoles table:
 *   npx ts-node scripts/migrate-roles-to-join-table.ts
 */
async function migrateRolesToJoinTable() {
  console.log("Starting multi-role migration...\n");
  console.log("Migrating users.roleId → userRoles join table\n");

  try {
    // Get all users with existing roleId
    const usersWithRole = await db
      .select({
        id: users.id,
        email: users.email,
        roleId: users.roleId,
      })
      .from(users)
      .where(isNotNull(users.roleId));

    console.log(`Found ${usersWithRole.length} users with existing roles\n`);

    let migrated = 0;
    let skipped = 0;
    let failed = 0;

    // Migrate each user's roleId to userRoles join table
    for (const user of usersWithRole) {
      if (!user.roleId) {
        console.log(`⊘ Skipping ${user.email} (no roleId)`);
        skipped++;
        continue;
      }

      try {
        // Insert into userRoles (with onConflictDoNothing to skip duplicates)
        const result = await db
          .insert(userRoles)
          .values({
            userId: user.id,
            roleId: user.roleId,
          })
          .onConflictDoNothing()
          .returning();

        if (result.length > 0) {
          console.log(`✓ Migrated ${user.email}`);
          migrated++;
        } else {
          console.log(`⊘ Already migrated ${user.email}`);
          skipped++;
        }
      } catch (error) {
        console.error(`✗ Failed to migrate ${user.email}:`, error);
        failed++;
      }
    }

    console.log(`\nMigration complete!`);
    console.log(`  Migrated: ${migrated}`);
    console.log(`  Skipped:  ${skipped}`);
    console.log(`  Failed:   ${failed}`);

    if (failed === 0) {
      console.log(`\n✓ All users successfully migrated!`);
    } else {
      console.log(`\n⚠ Some users failed to migrate. Please review the errors above.`);
      process.exit(1);
    }
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  }
}

migrateRolesToJoinTable();
