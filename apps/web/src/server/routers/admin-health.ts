import { createAdminRouter, procedure } from "../adminTrpc";
import { db } from "@/lib/db/client";
import { sql } from "drizzle-orm";

export const adminHealthRouter = createAdminRouter({
  getStatus: procedure.query(async () => {
    const start = Date.now();

    try {
      await db.execute(sql`SELECT 1`);
      return {
        status: "ok" as const,
        db: "ok" as const,
        dbLatencyMs: Date.now() - start,
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        status: "degraded" as const,
        db: "error" as const,
        dbLatencyMs: Date.now() - start,
        timestamp: new Date(),
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }),
});
