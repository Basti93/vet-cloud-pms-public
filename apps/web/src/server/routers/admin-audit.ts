import { z } from "zod";
import { createAdminRouter, procedure } from "../adminTrpc";
import { auditLogs, tenants } from "@/lib/db/schema";
import { and, desc, eq, gte, lte, sql } from "drizzle-orm";

export const adminAuditRouter = createAdminRouter({
  getSummary: procedure
    .input(
      z.object({
        hours: z.number().int().min(1).max(24 * 30).default(24),
        tenantId: z.string().uuid().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const since = new Date(Date.now() - input.hours * 60 * 60 * 1000);
      const conditions = [gte(auditLogs.createdAt, since)];
      if (input.tenantId) {
        conditions.push(eq(auditLogs.tenantId, input.tenantId));
      }

      const [totals] = await ctx.db
        .select({
          total: sql<number>`count(*)`,
          createCount: sql<number>`count(*) filter (where ${auditLogs.action} = 'create')`,
          updateCount: sql<number>`count(*) filter (where ${auditLogs.action} = 'update')`,
          deleteCount: sql<number>`count(*) filter (where ${auditLogs.action} = 'delete')`,
          exportCount: sql<number>`count(*) filter (where ${auditLogs.action} = 'export')`,
          distinctUsers: sql<number>`count(distinct ${auditLogs.userId})`,
          distinctEntities: sql<number>`count(distinct ${auditLogs.entityType})`,
        })
        .from(auditLogs)
        .where(and(...conditions));

      const topActions = await ctx.db
        .select({
          action: auditLogs.action,
          count: sql<number>`count(*)`,
        })
        .from(auditLogs)
        .where(and(...conditions))
        .groupBy(auditLogs.action)
        .orderBy(desc(sql`count(*)`))
        .limit(5);

      const topEntityTypes = await ctx.db
        .select({
          entityType: auditLogs.entityType,
          count: sql<number>`count(*)`,
        })
        .from(auditLogs)
        .where(and(...conditions))
        .groupBy(auditLogs.entityType)
        .orderBy(desc(sql`count(*)`))
        .limit(5);

      return {
        hours: input.hours,
        total: Number(totals?.total ?? 0),
        createCount: Number(totals?.createCount ?? 0),
        updateCount: Number(totals?.updateCount ?? 0),
        deleteCount: Number(totals?.deleteCount ?? 0),
        exportCount: Number(totals?.exportCount ?? 0),
        distinctUsers: Number(totals?.distinctUsers ?? 0),
        distinctEntities: Number(totals?.distinctEntities ?? 0),
        topActions: topActions.map((a) => ({
          action: a.action,
          count: Number(a.count ?? 0),
        })),
        topEntityTypes: topEntityTypes.map((e) => ({
          entityType: e.entityType,
          count: Number(e.count ?? 0),
        })),
      };
    }),

  list: procedure
    .input(
      z.object({
        tenantId: z.string().uuid().optional(),
        action: z.string().min(1).max(100).optional(),
        entityType: z.string().min(1).max(100).optional(),
        startDate: z.date().optional(),
        endDate: z.date().optional(),
        limit: z.number().int().min(1).max(200).default(100),
      })
    )
    .query(async ({ ctx, input }) => {
      const conditions = [];

      if (input.tenantId) conditions.push(eq(auditLogs.tenantId, input.tenantId));
      if (input.action) conditions.push(eq(auditLogs.action, input.action));
      if (input.entityType) conditions.push(eq(auditLogs.entityType, input.entityType));
      if (input.startDate) conditions.push(gte(auditLogs.createdAt, input.startDate));
      if (input.endDate) conditions.push(lte(auditLogs.createdAt, input.endDate));

      const query = ctx.db
        .select({
          id: auditLogs.id,
          tenantId: auditLogs.tenantId,
          tenantName: tenants.name,
          userId: auditLogs.userId,
          action: auditLogs.action,
          entityType: auditLogs.entityType,
          entityId: auditLogs.entityId,
          createdAt: auditLogs.createdAt,
        })
        .from(auditLogs)
        .leftJoin(tenants, eq(auditLogs.tenantId, tenants.id))
        .orderBy(desc(auditLogs.createdAt))
        .limit(input.limit);

      if (conditions.length > 0) {
        query.where(and(...conditions));
      }

      return { items: await query };
    }),

  getDetails: procedure
    .input(z.object({ auditId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [entry] = await ctx.db
        .select({
          id: auditLogs.id,
          tenantId: auditLogs.tenantId,
          tenantName: tenants.name,
          userId: auditLogs.userId,
          action: auditLogs.action,
          entityType: auditLogs.entityType,
          entityId: auditLogs.entityId,
          changes: auditLogs.changes,
          ipAddress: auditLogs.ipAddress,
          userAgent: auditLogs.userAgent,
          createdAt: auditLogs.createdAt,
        })
        .from(auditLogs)
        .leftJoin(tenants, eq(auditLogs.tenantId, tenants.id))
        .where(eq(auditLogs.id, input.auditId))
        .limit(1);

      if (!entry) {
        throw new Error("Audit entry not found");
      }
      return entry;
    }),
});
