import { sql } from "drizzle-orm";
import type { Database } from "@/lib/db/client";

// Wraps a callback in a DB transaction with app.current_tenant_id set via SET LOCAL.
// The transaction-scoped client (tx) is passed to the callback so RLS policies apply.
// SET LOCAL is scoped to the transaction — safe with connection pools.
export const withTenantContext = async <T>(
  db: Database,
  tenantId: string,
  fn: (tx: Database) => Promise<T>
): Promise<T> => {
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT set_config('app.current_tenant_id', ${tenantId}, true)`);
    return fn(tx as unknown as Database);
  });
};
