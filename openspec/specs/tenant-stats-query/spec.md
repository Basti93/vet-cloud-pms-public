# Tenant Stats Query

`admin-core.ts → listTenants` fires N+1 Postgres queries: 1 to fetch the page of tenants,
then 1 `SELECT count(users.id)` per tenant on the page (up to 50 = 51 queries per page load).

The N+1 is invisible at the procedure interface and untestable without a populated database.
As tenant count grows this becomes the primary admin performance bottleneck.

## Requirements

### Requirement: Tenant list with stats uses at most 2 database queries
The `listTenants` admin procedure SHALL retrieve tenants and their associated user counts
using at most 2 SQL queries regardless of page size, and SHALL NOT issue one count query
per tenant.

#### Scenario: List 50 tenants
- **WHEN** `listTenants` is called with `limit: 50`
- **THEN** at most 2 database queries are issued to fulfil the response
- **AND** each returned tenant includes the correct `userCount`

#### Scenario: Empty results
- **WHEN** `listTenants` returns 0 tenants (no matches)
- **THEN** 1 query is issued (the tenant select) and no count queries are issued

### Requirement: Tenant stats retrieval is a named, testable module
Fetching tenants with aggregated stats SHALL be encapsulated in a module with a defined
interface, injectable for testing. The `listTenants` procedure body SHALL not contain
inline `Promise.all(items.map(...))` patterns.

#### Scenario: Module testable with mock data
- **WHEN** a unit test calls `queryTenantsWithStats(db, { limit: 3, ... })`
- **THEN** it can assert on returned `userCount` values without a real database

## Proposed Interface

```typescript
// apps/web/src/server/queries/tenant-stats.ts

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

/**
 * Fetches a page of tenants with user counts in 2 queries:
 *   1. Paginated tenant SELECT with filters
 *   2. Single GROUP BY count of users for all returned tenant IDs
 *
 * Deletion schedule data is joined or batched in the same second query.
 */
export async function queryTenantsWithStats(
  db: DrizzleDB,
  filters: TenantListFilters
): Promise<TenantStatsResult>;
```

## Implementation Notes

Two query approach:
```sql
-- query 1: paginated tenants
SELECT id, name, ... FROM tenants WHERE ... ORDER BY created_at DESC LIMIT 51;

-- query 2: aggregated user counts for all tenant IDs from query 1
SELECT tenant_id, COUNT(*) as user_count
FROM users
WHERE tenant_id = ANY($1)
GROUP BY tenant_id;
```

Deletion schedules can be fetched in the same batch as query 2 (already done correctly
via `inArray` in the current code — keep that, just move it into the module).

## Files

| File | Change |
|------|--------|
| `apps/web/src/server/queries/tenant-stats.ts` | **New** — implement `queryTenantsWithStats` |
| `apps/web/src/server/routers/admin-core.ts` | Replace `Promise.all(items.map(...))` block with `queryTenantsWithStats` call |

## Verification

```bash
rtk tsc
grep -n "Promise.all" apps/web/src/server/routers/admin-core.ts
# should return 0 matches in listTenants procedure
```

Manual check: open admin tenant list in staging, watch Postgres query log — confirm 2 queries max per page load.

## Effort / Risk
- Effort: ~1.5h
- Risk: **low** — admin-only, no patient data path, easy to verify in staging
