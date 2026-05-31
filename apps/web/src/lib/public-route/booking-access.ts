import { adminDb, type Database } from "@/lib/db/client";
import { tenants, users } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";

export async function canAccessPublicBookingTenant(
  input: { tenantSlug: string; previewToken?: string; userId?: string | null },
  database: Database = adminDb
): Promise<boolean> {
  const [tenant] = await database
    .select({ id: tenants.id, websiteEnabled: tenants.websiteEnabled, previewToken: tenants.previewToken })
    .from(tenants)
    .where(eq(tenants.slug, input.tenantSlug))
    .limit(1);

  if (!tenant) return false;
  if (tenant.websiteEnabled) return true;

  const isPreviewValid = Boolean(
    input.previewToken && tenant.previewToken && input.previewToken === tenant.previewToken
  );
  if (isPreviewValid) return true;
  if (!input.userId) return false;

  const [member] = await database
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.clerkId, input.userId), eq(users.tenantId, tenant.id)))
    .limit(1);

  return Boolean(member);
}
