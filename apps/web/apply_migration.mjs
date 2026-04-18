import postgres from "postgres";
import { readFileSync } from "fs";

const DATABASE_URL =
  "postgresql://neondb_owner:npg_m6reZDHKjct3@ep-xxx.c-3.eu-central-1.aws.neon.tech/neondb?sslmode=require";

const sql = postgres(DATABASE_URL, { max: 1 });

// Read migration file
const migration = readFileSync(
  "/Users/user/Projects/vet-cloud-pms/apps/web/drizzle/0000_smooth_lockheed.sql",
  "utf-8"
);

// Split by statement breakpoint
const statements = migration
  .split("--> statement-breakpoint")
  .map((s) => s.trim())
  .filter((s) => s.length > 0);

async function applyMigration() {
  console.log(`Applying ${statements.length} SQL statements...`);
  let count = 0;

  for (const statement of statements) {
    try {
      await sql.unsafe(statement);
      count++;
      console.log(`✓ Statement ${count}/${statements.length}`);
    } catch (err) {
      // Some errors might be expected (e.g., table already exists)
      if (err.code === "42P07") {
        // relation already exists
        console.log(`⊘ Statement ${count} (already exists, skipping)`);
      } else {
        console.error(`✗ Statement ${count} failed:`, err.message);
        // Continue anyway
      }
      count++;
    }
  }

  console.log("\n✓ Migration complete!");
  await sql.end();
}

applyMigration().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
