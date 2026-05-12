import fs from "fs";
import path from "path";

// Try DATABASE_URL from environment first (for Vercel CI/CD)
// Then load from .env.production.local or .env.local
if (!process.env.DATABASE_URL) {
  const productionEnvPath = path.resolve(process.cwd(), ".env.production.local");
  const developmentEnvPath = path.resolve(process.cwd(), ".env.local");

  const envPath = fs.existsSync(productionEnvPath) ? productionEnvPath : developmentEnvPath;

  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, "utf-8");
    envContent.split("\n").forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) {
        return;
      }
      const [key, ...valueParts] = trimmed.split("=");
      if (key && valueParts.length > 0 && !process.env[key]) {
        process.env[key] = valueParts.join("=").trim();
      }
    });
  }
}

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set. Set it in environment or .env files");
}

const databaseUrl = process.env.DATABASE_URL;
const migrationUrl =
  databaseUrl.includes("sslmode=")
    ? databaseUrl
    : databaseUrl + (databaseUrl.includes("?") ? "&sslmode=require" : "?sslmode=require");

const drizzleConfig = {
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: migrationUrl,
  },
  strict: true,
  verbose: true,
};

export default drizzleConfig;
