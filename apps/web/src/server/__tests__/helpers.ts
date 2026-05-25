// @vitest-environment node
// Integration test helpers. Each test file that imports createTestDb gets its
// own isolated Postgres container — no state bleed between files.
//
// Usage:
//   const { db, cleanup } = await createTestDb();
//   const { tenant, user } = await seedTestTenant(db);
//   const caller = createTestCaller(db, { clerkId: user.clerkId, permissions: [PERMISSIONS.APPOINTMENTS_CREATE] });
//   afterAll(cleanup);

import { PostgreSqlContainer } from "@testcontainers/postgresql";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { resolve } from "path";
import * as schema from "@/lib/db/schema";
import { tenants, users } from "@/lib/db/schema";
import { createCallerFactory } from "@/server/trpc";
import { appRouter } from "@/server/routers/_app";

export type TestDb = ReturnType<typeof drizzle<typeof schema>>;

const createCaller = createCallerFactory(appRouter);

export async function createTestDb() {
  const container = await new PostgreSqlContainer("postgres:16-alpine").start();
  const connectionUri = container.getConnectionUri();
  const sql = postgres(connectionUri, { max: 1 });
  const db = drizzle(sql, { schema }) as TestDb;
  await migrate(db as any, {
    migrationsFolder: resolve(process.cwd(), "drizzle"),
  });
  return {
    db,
    cleanup: async () => {
      await sql.end();
      await container.stop();
    },
  };
}

export async function seedTestTenant(
  db: TestDb,
  { clerkId = "test_clerk_user_id", slug = "test-praxis" }: { clerkId?: string; slug?: string } = {}
) {
  const [tenant] = await db
    .insert(tenants)
    .values({
      name: "Test Praxis",
      slug,
      email: "test@praxis.de",
    })
    .returning();

  const [user] = await db
    .insert(users)
    .values({
      clerkId,
      tenantId: tenant.id,
      email: "test@praxis.de",
      firstName: "Test",
      lastName: "User",
    })
    .returning();

  return { tenant, user };
}

/**
 * Build a tRPC caller backed by the testcontainers DB.
 *
 * Pre-populates `permissionCache` so `requirePermission` never hits the global
 * DB. The `enforceTenantIsActive` middleware will still query testcontainers for
 * the user by clerkId — seed that user first with `seedTestTenant`.
 */
export function createTestCaller(
  db: TestDb,
  {
    clerkId = "test_clerk_user_id",
    permissions = [] as string[],
  }: { clerkId?: string; permissions?: string[] } = {}
) {
  return createCaller({
    db: db as any,
    adminDb: db as any,
    userId: clerkId,
    headers: new Headers(),
    // Cast required: TRPCContext types permissionCache as undefined (initial value),
    // but requirePermission reads it as Set<string> at runtime. Pre-populating
    // bypasses getUserPermissions DB calls during tests.
    permissionCache: new Set(permissions) as unknown as undefined,
  });
}
