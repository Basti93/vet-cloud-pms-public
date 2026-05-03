import { db } from "@/lib/db/client";
import { users, roles, userRoles } from "@/lib/db/schema";

async function checkRoles() {
  console.log("🔍 Checking database state...\n");

  // Check users table
  const allUsers = await db.select().from(users);
  console.log(`Total users: ${allUsers.length}`);
  console.log("Users:");
  allUsers.forEach(u => {
    console.log(`  - ${u.email || u.id}`);
  });

  console.log("\n");

  // Check roles table
  const allRoles = await db.select().from(roles);
  console.log(`Total roles in DB: ${allRoles.length}`);
  allRoles.forEach(r => {
    console.log(`  - ${r.name} (id: ${r.id})`);
  });

  console.log("\n");

  // Check userRoles table
  const allUserRoles = await db.select().from(userRoles);
  console.log(`Total userRoles associations: ${allUserRoles.length}`);
  allUserRoles.forEach(ur => {
    console.log(`  - userId: ${ur.userId}, roleId: ${ur.roleId}`);
  });

  console.log("\n");

  console.log("Role source of truth is user_roles.");
}

checkRoles().catch(console.error);
