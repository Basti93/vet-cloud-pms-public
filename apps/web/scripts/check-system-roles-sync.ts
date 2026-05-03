import "dotenv/config";
import { and, eq, ne } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { roles } from "@/lib/db/schema";
import { SYSTEM_ROLES_VERSION } from "@/lib/auth/roles";

async function main() {
  const outOfSync = await db
    .select({
      tenantId: roles.tenantId,
      code: roles.code,
      name: roles.name,
      baseVersion: roles.baseVersion,
    })
    .from(roles)
    .where(and(eq(roles.isSystem, true), ne(roles.baseVersion, SYSTEM_ROLES_VERSION)));

  if (outOfSync.length === 0) {
    console.log(`OK: all system roles are synced at version ${SYSTEM_ROLES_VERSION}.`);
    return;
  }

  console.error(
    `RBAC drift detected: ${outOfSync.length} system role(s) are not on version ${SYSTEM_ROLES_VERSION}.`
  );

  for (const role of outOfSync.slice(0, 50)) {
    console.error(
      ` - tenant=${role.tenantId} role=${role.code} (${role.name}) baseVersion=${role.baseVersion}`
    );
  }

  console.error("Run: npx tsx scripts/sync-system-roles.ts");
  process.exit(1);
}

main().catch((error) => {
  console.error("Failed to check RBAC sync status:", error);
  process.exit(1);
});

