import { and, eq, lte } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { roles, tenantDeletionSchedules, tenants, users } from "@/lib/db/schema";
import { sendTenantLifecycleEmail } from "@/lib/email/service";

export async function hardDeleteTenantById(tenantId: string) {
  const tenantUsers = await db
    .select({ clerkId: users.clerkId })
    .from(users)
    .where(eq(users.tenantId, tenantId));

  const clerkSecretKey = process.env.CLERK_SECRET_KEY;
  if (clerkSecretKey && tenantUsers.length > 0) {
    for (const u of tenantUsers) {
      try {
        const response = await fetch(`https://api.clerk.com/v1/users/${u.clerkId}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${clerkSecretKey}` },
        });
        if (!response.ok && response.status !== 404) {
          console.error(`Failed to delete Clerk user ${u.clerkId}:`, response.statusText);
        }
      } catch (error) {
        console.error(`Error deleting Clerk user ${u.clerkId}:`, error);
      }
    }
  }

  const deleted = await db.transaction(async (tx) => {
    // roles.tenant_id -> tenants.id has no ON DELETE CASCADE in current schema.
    // Delete tenant-bound roles explicitly before deleting the tenant.
    await tx.delete(roles).where(eq(roles.tenantId, tenantId));

    return tx
      .delete(tenants)
      .where(eq(tenants.id, tenantId))
      .returning({ id: tenants.id, slug: tenants.slug, name: tenants.name });
  });

  return deleted[0] ?? null;
}

export async function executeDueTenantDeletions() {
  const now = new Date();
  const due = await db
    .select({ id: tenantDeletionSchedules.id, tenantId: tenantDeletionSchedules.tenantId })
    .from(tenantDeletionSchedules)
    .where(
      and(
        eq(tenantDeletionSchedules.status, "scheduled"),
        lte(tenantDeletionSchedules.scheduledFor, now)
      )
    );

  let executed = 0;
  let failed = 0;

  for (const item of due) {
    try {
      const [tenant] = await db
        .select({ name: tenants.name, email: tenants.email })
        .from(tenants)
        .where(eq(tenants.id, item.tenantId))
        .limit(1);

      if (tenant?.email) {
        await sendTenantLifecycleEmail({
          to: tenant.email,
          practiceName: tenant.name,
          subject: `Praxislöschung wird ausgeführt: ${tenant.name}`,
          body: "Die 30-Tage-Frist ist abgelaufen. Ihre Praxis wird jetzt endgültig gelöscht.",
        });
      }

      await hardDeleteTenantById(item.tenantId);
      await db
        .update(tenantDeletionSchedules)
        .set({ status: "executed", executedAt: new Date(), updatedAt: new Date() })
        .where(eq(tenantDeletionSchedules.id, item.id));

      if (tenant?.email) {
        await sendTenantLifecycleEmail({
          to: tenant.email,
          practiceName: tenant.name,
          subject: `Praxis endgültig gelöscht: ${tenant.name}`,
          body: "Die Praxis und zugehörige Daten wurden endgültig gelöscht.",
        });
      }
      executed++;
    } catch (error) {
      failed++;
      console.error("Failed to execute tenant deletion", {
        scheduleId: item.id,
        tenantId: item.tenantId,
        error,
      });
    }
  }

  return { dueCount: due.length, executed, failed };
}
