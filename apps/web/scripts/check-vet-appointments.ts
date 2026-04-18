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
import { users, appointments } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error("DATABASE_URL is not set");
const dbUrl = DATABASE_URL + (DATABASE_URL.includes("?") ? "&sslmode=require" : "?sslmode=require");
const sql = postgres(dbUrl, { max: 1 });
const db = drizzle(sql, { schema: { users, appointments } });

(async () => {
  // Get all vets
  const allVets = await db.select().from(users).where(eq(users.role, "vet"));
  console.log("All vets:", allVets.map((v: any) => `${v.firstName} ${v.lastName} (${v.id})`));

  // Get appointments count by vet
  console.log("\nAppointments by vet:");
  for (const vet of allVets) {
    const appts = await db.select().from(appointments).where(eq(appointments.vetId, vet.id));
    console.log(`  ${vet.firstName} ${vet.lastName}: ${appts.length} appointments`);
  }

  // Get total appointments
  const totalAppts = await db.select().from(appointments);
  console.log(`\nTotal appointments in DB: ${totalAppts.length}`);

  await sql.end();
})();
