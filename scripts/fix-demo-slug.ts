/**
 * Quick fix: Add slug to demo tenant if missing
 * Usage: npx tsx scripts/fix-demo-slug.ts
 */

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { tenants } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import * as fs from "fs";
import * as path from "path";

// Load .env.local manually
const envPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  envContent.split("\n").forEach((line) => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#")) {
      const [key, ...valueParts] = trimmed.split("=");
      if (key && valueParts.length > 0) {
        process.env[key.trim()] = valueParts.join("=").trim();
      }
    }
  });
}

const DEMO_TENANT_ID = "00000000-0000-4000-8000-000000000003";
const DEMO_TENANT_SLUG = "demo";

async function main() {
  const DATABASE_URL = process.env.DATABASE_URL;
  if (!DATABASE_URL) {
    console.error("❌ DATABASE_URL not set");
    process.exit(1);
  }

  const dbUrl =
    DATABASE_URL +
    (DATABASE_URL.includes("?") ? "&sslmode=require" : "?sslmode=require");
  const sql = postgres(dbUrl, { max: 1 });
  const db = drizzle(sql, { schema: { tenants } });

  try {
    console.log(`🔄 Updating demo tenant slug to "${DEMO_TENANT_SLUG}"...`);

    const result = await db
      .update(tenants)
      .set({ slug: DEMO_TENANT_SLUG })
      .where(eq(tenants.id, DEMO_TENANT_ID));

    console.log(`✅ Done!`);
    console.log(`\n📌 Demo booking URL: /book/${DEMO_TENANT_SLUG}`);
    console.log(`   Tenant ID: ${DEMO_TENANT_ID}`);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

main();
