#!/usr/bin/env node

/**
 * Delete a practice (praxis) by UUID
 *
 * Usage: npx ts-node scripts/delete-praxis.ts <tenant-uuid>
 *
 * This will:
 * 1. Find the practice by UUID
 * 2. Delete all related data (cascade):
 *    - Users (vet, staff, reception)
 *    - Appointments
 *    - Patients
 *    - Owners
 *    - Email settings
 *    - Feature flags
 *    - All other related records
 * 3. Delete the practice tenant itself
 */

import * as fs from "fs";
import * as path from "path";
import postgres from "postgres";

// Load .env.local
const envPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  envContent.split("\n").forEach((line) => {
    const [key, value] = line.split("=");
    if (key && value && !process.env[key]) {
      process.env[key] = value.trim();
    }
  });
}

const tenantUuid = process.argv[2];

if (!tenantUuid) {
  console.error("❌ Usage: npx ts-node scripts/delete-praxis.ts <tenant-uuid>");
  console.error("");
  console.error("Example:");
  console.error("  npx ts-node scripts/delete-praxis.ts f47ac10b-58cc-4372-a567-0e02b2c3d479");
  process.exit(1);
}

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error("❌ DATABASE_URL environment variable not set");
  process.exit(1);
}

async function deletePraxis() {
  // Ensure SSL mode is set for secure connections
  const url = dbUrl + (dbUrl.includes("?") ? "&sslmode=require" : "?sslmode=require");
  const sql = postgres(url, {
    ssl: "require",
    transform: postgres.camelCase
  });

  try {
    console.log(`🔍 Looking up practice: ${tenantUuid}`);

    // Verify the tenant exists
    const tenant = await sql`
      SELECT id, name, slug FROM tenants WHERE id = ${tenantUuid}
    `;

    if (tenant.length === 0) {
      console.error(`❌ Practice not found: ${tenantUuid}`);
      process.exit(1);
    }

    const { name, slug } = tenant[0];
    console.log(`📋 Found practice: "${name}" (slug: ${slug})`);
    console.log("");
    console.log("⚠️  This will DELETE:");
    console.log("   - The practice and all settings");
    console.log("   - All users (admin, vets, staff)");
    console.log("   - All appointments and bookings");
    console.log("   - All patients and owners");
    console.log("   - All email settings and logs");
    console.log("   - All feature flags");
    console.log("");

    // Confirm deletion
    if (process.argv[3] !== "--force") {
      console.log("To confirm deletion, run:");
      console.log(`  npx ts-node scripts/delete-praxis.ts ${tenantUuid} --force`);
      console.log("");
      process.exit(0);
    }

    console.log("🗑️  Deleting practice...");

    // Delete the tenant (all related data cascades)
    const result = await sql`
      DELETE FROM tenants WHERE id = ${tenantUuid}
    `;

    console.log(`✅ Practice deleted: "${name}" (${tenantUuid})`);
    console.log(`   ${result.count} record(s) affected`);
    console.log("");
    console.log("All related data has been automatically removed.");

  } catch (error: any) {
    console.error("❌ Error deleting practice:", error.message);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

deletePraxis();
