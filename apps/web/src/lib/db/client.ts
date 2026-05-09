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
type DrizzleDb = ReturnType<typeof drizzle<typeof schema>>;

let _appDb: DrizzleDb | undefined;
let _adminDb: DrizzleDb | undefined;

function createDb(connectionString: string, maxConnections: number): DrizzleDb {
  const client = postgres(connectionString, { max: maxConnections });
  return drizzle(client, { schema });
}

function getAppDb(): DrizzleDb {
  if (!_appDb) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error("DATABASE_URL is not set");
    }
    _appDb = createDb(url, Number(process.env.APP_DB_POOL_MAX ?? 2));
  }
  return _appDb;
}

function getAdminDb(): DrizzleDb {
  if (!_adminDb) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error("DATABASE_URL is not set");
    }
    _adminDb = createDb(url, Number(process.env.ADMIN_DB_POOL_MAX ?? 2));
  }
  return _adminDb;
}

function createDbProxy(getter: () => DrizzleDb) {
  return new Proxy({} as DrizzleDb, {
    get(_target, prop) {
      return Reflect.get(getter(), prop);
    },
  });
}

// Default app-facing DB proxy (customer traffic).
export const db = createDbProxy(getAppDb);

// Dedicated proxy for admin procedures (separate connection pool).
export const adminDb = createDbProxy(getAdminDb);

export type Database = typeof db;
