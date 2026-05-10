/**
 * Global database seed script (tenant-agnostic)
 *
 * Purpose:
 * - Seed global reference data required for all tenants
 * - Do NOT create demo tenant/business data
 *
 * Demo data lifecycle (nightly reset / demo reseed) is handled by:
 * - apps/web/scripts/demo-reset.ts --reset
 */

import fs from "fs";
import path from "path";

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

import { seedVaccinationTypes } from "../src/lib/db/seed-vaccination-types";

async function seed() {
  try {
    console.log("🌱 Starting global seed...\n");

    // ────────────────────────────────────────────────────────────────────────
    // GLOBAL REFERENCE DATA
    // ────────────────────────────────────────────────────────────────────────
    console.log("💉 Seeding vaccination types catalogue...");
    await seedVaccinationTypes();
    console.log("  ✓ Vaccination types upserted\n");

    console.log("✨ Global seed completed successfully!");
    console.log("ℹ️  Demo tenant data is managed by: npx tsx scripts/demo-reset.ts --reset");
  } catch (error) {
    console.error("❌ Global seed failed:", error);
    process.exit(1);
  }
}

seed()
  .catch((err) => {
    console.error("❌ Global seed process error:", err);
    process.exit(1);
  })
  .then(() => {
    process.exit(0);
  });
