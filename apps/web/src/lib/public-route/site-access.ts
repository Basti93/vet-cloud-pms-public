import { auth } from "@clerk/nextjs/server";
import { adminDb, type Database } from "@/lib/db/client";
import { tenants, users, websiteProjects } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";

export interface AccessInfo {
  ownerType: "tenant" | "standalone";
  websiteEnabled: boolean | null;
  tenantId: string | null;
  // token from tenant row (tenant projects) or project row (standalone projects)
  previewToken: string | null;
}

export async function getAccessInfo(
  projectId: string,
  database: Database = adminDb
): Promise<AccessInfo | null> {
  const [row] = await database
    .select({
      ownerType: websiteProjects.ownerType,
      projectPreviewToken: websiteProjects.previewToken,
      tenantId: tenants.id,
      websiteEnabled: tenants.websiteEnabled,
      tenantPreviewToken: tenants.previewToken,
    })
    .from(websiteProjects)
    .leftJoin(tenants, eq(tenants.id, websiteProjects.ownerTenantId))
    .where(eq(websiteProjects.id, projectId))
    .limit(1);

  if (!row) return null;

  const isStandalone = row.ownerType === "standalone";
  return {
    ownerType: row.ownerType as "tenant" | "standalone",
    // standalone projects are never publicly enabled
    websiteEnabled: isStandalone ? false : (row.websiteEnabled ?? false),
    tenantId: row.tenantId,
    previewToken: isStandalone ? row.projectPreviewToken : row.tenantPreviewToken,
  };
}

export async function canView(
  access: AccessInfo,
  urlToken: string | null | undefined,
  options?: { database?: Database; userId?: string | null }
): Promise<boolean> {
  const database = options?.database ?? adminDb;
  const userId = options?.userId ?? (await auth()).userId;

  if (urlToken && access.previewToken && urlToken === access.previewToken) return true;
  // standalone projects: only preview token grants access, no Clerk fallback
  if (access.ownerType === "standalone") return false;
  if (!access.tenantId) return false;
  if (!userId) return false;

  const [member] = await database
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.clerkId, userId), eq(users.tenantId, access.tenantId)))
    .limit(1);
  return Boolean(member);
}
