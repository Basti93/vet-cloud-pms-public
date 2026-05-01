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
      const [key, value] = line.split("=");
      if (key && value && !process.env[key]) {
        process.env[key] = value.trim();
      }
    });
  }
}

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set. Set it in environment or .env files");
}

const drizzleConfig = {
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL + (process.env.DATABASE_URL?.includes("?") ? "&sslmode=require" : "?sslmode=require"),
  },
  strict: true,
  verbose: true,
};

export default drizzleConfig;
