import fs from "fs";
import path from "path";

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

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { appointments, diagnoses, medications, vitals, patients, owners, users, vetSchedules, roles } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

const DEMO_TENANT_ID = "00000000-0000-4000-8000-000000000003";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error("DATABASE_URL is not set");
const dbUrl = DATABASE_URL + (DATABASE_URL.includes("?") ? "&sslmode=require" : "?sslmode=require");
const sql = postgres(dbUrl, { max: 1 });
const db = drizzle(sql, { schema: { appointments, diagnoses, medications, vitals, patients, owners, users, vetSchedules, roles } });

(async () => {
  console.log("🗑️  Deleting all test data...");

  await db.delete(appointments).where(eq(appointments.tenantId, DEMO_TENANT_ID));
  await db.delete(diagnoses).where(eq(diagnoses.tenantId, DEMO_TENANT_ID));
  await db.delete(medications).where(eq(medications.tenantId, DEMO_TENANT_ID));
  await db.delete(vitals).where(eq(vitals.tenantId, DEMO_TENANT_ID));
  await db.delete(patients).where(eq(patients.tenantId, DEMO_TENANT_ID));
  await db.delete(owners).where(eq(owners.tenantId, DEMO_TENANT_ID));
  await db.delete(vetSchedules).where(eq(vetSchedules.tenantId, DEMO_TENANT_ID));
  await db.delete(users).where(eq(users.tenantId, DEMO_TENANT_ID));
  await db.delete(roles).where(eq(roles.tenantId, DEMO_TENANT_ID));

  console.log("✅ All data deleted");

  await sql.end();
})();
