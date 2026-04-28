import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import path from "path";
import fs from "fs";
import { tenants } from "../src/lib/db/schema";
import { DEMO_TENANT_ID } from "./test-data";

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

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error("DATABASE_URL not set");

const dbUrl = DATABASE_URL + (DATABASE_URL.includes("?") ? "&sslmode=require" : "?sslmode=require");
const sql = postgres(dbUrl, { max: 1 });
const db = drizzle(sql, { schema: { tenants } });

async function createDemoTenant() {
  try {
    // Use the authoritative DEMO_TENANT_ID from test-data.ts
    const result = await sql`
      INSERT INTO tenants (id, name, slug, email, phone, address, city, postal_code, country, subscription_status, subscription_plan, max_users)
      VALUES (${DEMO_TENANT_ID}::uuid, 'Demo Praxis', 'demo', 'demo@example.com', '+49 123 456789', 'Musterstraße 1', 'Musterstadt', '12345', 'DE', 'trial', 'starter', 5)
      ON CONFLICT DO NOTHING
      RETURNING *;
    `;
    const result_typed = result as any;

    console.log("✅ Demo Tenant created:", result_typed[0]?.name || "already exists");
    console.log("   Tenant ID:", DEMO_TENANT_ID);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

createDemoTenant();
