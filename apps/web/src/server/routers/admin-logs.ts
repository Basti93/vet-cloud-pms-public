import { z } from "zod";
import { createAdminRouter, procedure } from "../adminTrpc";
import { db } from "@/lib/db/client";
import { systemLogs } from "@/lib/db/schema";
import { eq, and, gte, lte, desc, inArray } from "drizzle-orm";

export const adminLogsRouter = createAdminRouter({
  /**
   * Query logs with optional filters
   */
  queryLogs: procedure
    .input(
      z.object({
        tenantId: z.string().uuid().optional(),
        level: z.enum(["debug", "info", "warn", "error", "critical"]).optional(),
        startDate: z.date().optional(),
        endDate: z.date().optional(),
        limit: z.number().default(50),
        cursor: z.string().optional(),
      })
    )
    .query(async ({ input }) => {
      const conditions = [];

      if (input.tenantId) {
        conditions.push(eq(systemLogs.tenantId, input.tenantId));
      }

      // Default to errors and critical only (if no level filter specified)
      if (input.level) {
        conditions.push(eq(systemLogs.level, input.level));
      } else {
        // Don't add default level filter if none specified - show all logs
      }

      if (input.startDate) {
        conditions.push(gte(systemLogs.timestamp, input.startDate));
      }

      if (input.endDate) {
        conditions.push(lte(systemLogs.timestamp, input.endDate));
      }

      const query = db
        .select({
          id: systemLogs.id,
          timestamp: systemLogs.timestamp,
          tenantId: systemLogs.tenantId,
          userId: systemLogs.userId,
          level: systemLogs.level,
          eventType: systemLogs.eventType,
          message: systemLogs.message,
          metadata: systemLogs.metadata,
        })
        .from(systemLogs);

      if (conditions.length > 0) {
        query.where(and(...conditions));
      }

      const result = await query
        .orderBy(desc(systemLogs.timestamp))
        .limit(input.limit + 1);

      const items = result.slice(0, input.limit);
      const nextCursor = result.length > input.limit ? result[input.limit].id : null;

      return { items, nextCursor };
    }),

  /**
   * Get full log entry with stack trace and metadata
   */
  getLogDetails: procedure
    .input(z.object({ logId: z.string().uuid() }))
    .query(async ({ input }) => {
      const [log] = await db
        .select()
        .from(systemLogs)
        .where(eq(systemLogs.id, input.logId));

      if (!log) {
        throw new Error("Log entry not found");
      }

      return log;
    }),
});
