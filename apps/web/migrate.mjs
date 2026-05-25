// Standalone migration runner — executed by entrypoint.sh before the server starts.
// Uses drizzle-orm's built-in migrator (no drizzle-kit needed at runtime).
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Migrations run as superuser to create roles, enable RLS, and manage policies.
// DATABASE_URL_ADMIN = superuser connection (required when DATABASE_URL is app_user).
// Falls back to DATABASE_URL so local dev and existing deploys need no changes.
const migrationUrl = process.env.DATABASE_URL_ADMIN ?? process.env.DATABASE_URL;
if (!migrationUrl) {
  console.error("DATABASE_URL_ADMIN (or DATABASE_URL) is not set — cannot run migrations");
  process.exit(1);
}

const sql = postgres(migrationUrl, { max: 1 });
const db = drizzle(sql);

try {
  await migrate(db, { migrationsFolder: join(__dirname, "drizzle") });
  console.log("Migrations complete");
} finally {
  await sql.end();
}
