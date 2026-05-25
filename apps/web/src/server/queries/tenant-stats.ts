import { and, desc, eq, inArray, like, sql } from "drizzle-orm";
import type { Database } from "@/lib/db/client";
import { tenantDeletionSchedules, tenants, users } from "@/lib/db/schema";

export interface TenantListFilters {
  search?: string;
  plan?: "solo" | "praxis" | "klinik";
  status?: "trial" | "active" | "paused" | "cancelled";
  limit: number;
  cursor?: string;
}

export interface TenantWithStats {
  id: string;
  name: string;
  slug: string;
  plan: string | null;
  status: string | null;
  email: string | null;
  createdAt: Date;
  stripeCustomerId: string | null;
  userCount: number;
  deletionStatus: string | null;
  deletionScheduledFor: Date | null;
}

export interface TenantStatsResult {
  items: TenantWithStats[];
  nextCursor: string | null;
}

export async function queryTenantsWithStats(
  db: Database,
  filters: TenantListFilters
): Promise<TenantStatsResult> {
  const query = db
    .select({
      id: tenants.id,
      name: tenants.name,
      slug: tenants.slug,
      plan: tenants.subscriptionPlan,
      status: tenants.subscriptionStatus,
      email: tenants.email,
      createdAt: tenants.createdAt,
      stripeCustomerId: tenants.stripeCustomerId,
    })
    .from(tenants);

  const conditions = [];
  if (filters.search) {
    conditions.push(like(tenants.name, `%${filters.search}%`));
  }
  if (filters.plan) {
    conditions.push(eq(tenants.subscriptionPlan, filters.plan));
  }
  if (filters.status) {
    conditions.push(eq(tenants.subscriptionStatus, filters.status));
  }

  if (conditions.length > 0) {
    query.where(and(...conditions));
  }

  const result = await query.orderBy(desc(tenants.createdAt)).limit(filters.limit + 1);
  const items = result.slice(0, filters.limit);
  const nextCursor = result.length > filters.limit ? result[filters.limit].id : null;

  if (items.length === 0) {
    return { items: [], nextCursor };
  }

  const tenantIds = items.map((item) => item.id);
  const statsRows = await db
    .select({
      tenantId: tenants.id,
      userCount: sql<number>`count(distinct ${users.id})`,
      deletionStatus: tenantDeletionSchedules.status,
      deletionScheduledFor: tenantDeletionSchedules.scheduledFor,
    })
    .from(tenants)
    .leftJoin(users, eq(users.tenantId, tenants.id))
    .leftJoin(
      tenantDeletionSchedules,
      eq(tenantDeletionSchedules.tenantId, tenants.id)
    )
    .where(inArray(tenants.id, tenantIds))
    .groupBy(
      tenants.id,
      tenantDeletionSchedules.status,
      tenantDeletionSchedules.scheduledFor
    );

  const statsByTenantId = new Map(
    statsRows.map((row) => [
      row.tenantId,
      {
        userCount: Number(row.userCount ?? 0),
        deletionStatus: row.deletionStatus ?? null,
        deletionScheduledFor: row.deletionScheduledFor ?? null,
      },
    ])
  );

  return {
    items: items.map((tenant) => {
      const stats = statsByTenantId.get(tenant.id);
      return {
        ...tenant,
        userCount: stats?.userCount ?? 0,
        deletionStatus: stats?.deletionStatus ?? null,
        deletionScheduledFor: stats?.deletionScheduledFor ?? null,
      };
    }),
    nextCursor,
  };
}
