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

// Lazy initialization — the module can be imported safely during Next.js static
// generation (e.g. /_not-found) without DATABASE_URL being present at build time.
// The error only surfaces when a route actually queries the database at runtime.
let _db: ReturnType<typeof drizzle<typeof schema>> | undefined;

function getDb(): ReturnType<typeof drizzle<typeof schema>> {
  if (!_db) {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL is not set");
    }
    // CI runner PostgreSQL doesn't need ssl unless explicitly configured.
    // Neon connection strings already include ?sslmode=require.
    const client = postgres(process.env.DATABASE_URL, {
      max: 1, // serverless-friendly: keep connections minimal
    });
    _db = drizzle(client, { schema });
  }
  return _db;
}

// Proxy so callers can use `db.select(...)` etc. without knowing about lazy init.
export const db = new Proxy({} as ReturnType<typeof drizzle<typeof schema>>, {
  get(_target, prop) {
    return Reflect.get(getDb(), prop);
  },
});

export type Database = typeof db;
