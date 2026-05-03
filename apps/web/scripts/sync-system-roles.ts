import { db } from "@/lib/db/client";
import { tenants } from "@/lib/db/schema";
import { createDefaultRoles } from "@/lib/auth/permissions";

async function main() {
  const allTenants = await db.select({ id: tenants.id, name: tenants.name }).from(tenants);
  console.log(`Syncing system roles for ${allTenants.length} tenant(s)...`);

  for (const tenant of allTenants) {
    await createDefaultRoles(tenant.id);
    console.log(`  ✓ ${tenant.name} (${tenant.id})`);
  }

  console.log("Done.");
}

main().catch((error) => {
  console.error("Failed to sync system roles:", error);
  process.exit(1);
});

