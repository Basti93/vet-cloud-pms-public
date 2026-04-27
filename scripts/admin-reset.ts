/**
 * Admin utilities: Set demo slug + reset demo tenant
 * Usage:
 *   - Set slug once: npx tsx scripts/admin-reset.ts --set-slug
 *   - Reset nightly: npx tsx scripts/admin-reset.ts --reset
 */

import postgres from "postgres";
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

  const command = process.argv[2];

  try {
    if (command === "--set-slug") {
      console.log(`🔄 Setting demo tenant slug to "${DEMO_TENANT_SLUG}"...`);

      const result = await sql`
        UPDATE tenants
        SET slug = ${DEMO_TENANT_SLUG}
        WHERE id = ${DEMO_TENANT_ID}
        RETURNING slug
      `;

      if (!result.length) {
        throw new Error("Demo tenant not found");
      }

      console.log(`✅ Success!`);
      console.log(`📌 Booking URL: /book/${DEMO_TENANT_SLUG}`);
    } else if (command === "--reset") {
      console.log(`🔄 Resetting demo tenant data...`);

      const voiceCallsResult = await sql`
        DELETE FROM voice_calls
        WHERE tenant_id = ${DEMO_TENANT_ID}
      `;

      const appointmentsResult = await sql`
        DELETE FROM appointments
        WHERE tenant_id = ${DEMO_TENANT_ID}
      `;

      const patientsResult = await sql`
        DELETE FROM patients
        WHERE tenant_id = ${DEMO_TENANT_ID}
      `;

      const ownersResult = await sql`
        DELETE FROM owners
        WHERE tenant_id = ${DEMO_TENANT_ID}
      `;

      console.log(`✅ Reset complete!`);
      console.log(`📊 Deleted:`);
      console.log(`   - Voice calls: ${voiceCallsResult.count || 0}`);
      console.log(`   - Appointments: ${appointmentsResult.count || 0}`);
      console.log(`   - Patients: ${patientsResult.count || 0}`);
      console.log(`   - Owners: ${ownersResult.count || 0}`);
    } else {
      console.log("Usage:");
      console.log("  npx tsx scripts/admin-reset.ts --set-slug    # Set demo slug once");
      console.log("  npx tsx scripts/admin-reset.ts --reset       # Reset demo tenant (nightly)");
      process.exit(1);
    }
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

main();
