import postgres from "postgres";

const DATABASE_URL =
  "postgresql://neondb_owner:npg_m6reZDHKjct3@ep-xxx.c-3.eu-central-1.aws.neon.tech/neondb?sslmode=require";

const sql = postgres(DATABASE_URL, { max: 1 });

async function addRoleId() {
  try {
    console.log("Adding role_id column to users table...");
    await sql`ALTER TABLE "users" ADD COLUMN "role_id" uuid`;
    console.log("✓ role_id column added");

    console.log("Adding foreign key constraint...");
    await sql`ALTER TABLE "users" ADD CONSTRAINT "users_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE set null`;
    console.log("✓ Foreign key constraint added");

    console.log("Adding index...");
    await sql`CREATE INDEX "users_role_id_idx" ON "users" USING btree ("role_id")`;
    console.log("✓ Index created");

    console.log("\n✓ Migration complete!");
  } catch (err) {
    if (err.code === "42701") {
      // Column already exists
      console.log("⊘ Column already exists, skipping");
    } else {
      console.error("✗ Error:", err.message);
      throw err;
    }
  } finally {
    await sql.end();
  }
}

addRoleId().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
