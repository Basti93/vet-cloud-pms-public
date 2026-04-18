import fs from "fs";
import path from "path";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// Load .env.local for scripts (seed, admin-reset)
if (typeof window === "undefined") {
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, "utf-8");
    envContent.split("\n").forEach((line) => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith("#")) {
        const [key, ...valueParts] = trimmed.split("=");
        if (key && valueParts.length > 0 && !process.env[key]) {
          process.env[key.trim()] = valueParts.join("=").trim();
        }
      }
    });
  }
}

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set");
}

// Neon requires ssl — the connection string already includes ?sslmode=require
const client = postgres(process.env.DATABASE_URL, {
  max: 1, // serverless-friendly: keep connections minimal
});

export const db = drizzle(client, { schema });

export type Database = typeof db;
