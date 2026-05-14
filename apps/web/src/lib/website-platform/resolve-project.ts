import { db } from "@/lib/db/client";
import { tenants, websiteDomains, websitePageRevisions, websitePages, websiteProjects } from "@/lib/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { normalizeBlocks, normalizeCapabilities, normalizeThemeConfig, websiteProjectSeoSchema } from "./schemas";
import type { ResolvedWebsitePage } from "./types";
import { openingHoursToDisplayRows, normalizeWeekSchedule, type DaySchedule } from "@/lib/schedule-types";

export function normalizeWebsiteHost(host?: string | null) {
  return (host ?? "").toLowerCase().trim().replace(/^www\./, "").split(":")[0] ?? "";
}

export function normalizeWebsitePath(pathname?: string | null) {
  const raw = pathname || "/";
  const path = raw.startsWith("/") ? raw : `/${raw}`;
  return path.length > 1 ? path.replace(/\/$/, "") : "/";
}

export async function resolveProjectByHostOrSlug(input: { host?: string | null; slug?: string | null }) {
  const host = normalizeWebsiteHost(input.host);
  if (host) {
    const [domainMatch] = await db
      .select({ projectId: websiteProjects.id })
      .from(websiteDomains)
      .innerJoin(websiteProjects, eq(websiteProjects.id, websiteDomains.websiteProjectId))
      .where(and(eq(websiteDomains.domain, host), eq(websiteDomains.status, "active")))
      .limit(1);
    if (domainMatch) return domainMatch.projectId;
  }

  if (input.slug) {
    const [project] = await db.select({ id: websiteProjects.id }).from(websiteProjects).where(eq(websiteProjects.slug, input.slug)).limit(1);
    return project?.id ?? null;
  }

  return null;
}

export async function resolvePublishedWebsitePage(input: { projectId: string; path: string }): Promise<ResolvedWebsitePage | null> {
  const normalizedPath = normalizeWebsitePath(input.path);
  const [row] = await db
    .select({
      projectId: websiteProjects.id,
      projectName: websiteProjects.name,
      projectSlug: websiteProjects.slug,
      projectStatus: websiteProjects.status,
      primaryDomain: websiteProjects.primaryDomain,
      layoutKey: websiteProjects.layoutKey,
      themeConfig: websiteProjects.themeConfig,
      customCss: websiteProjects.customCss,
      capabilities: websiteProjects.capabilities,
      projectSeo: websiteProjects.seoConfig,
      ownerTenantId: websiteProjects.ownerTenantId,
      tenantOpeningHours: tenants.openingHours,
      tenantAddress: tenants.address,
      tenantCity: tenants.city,
      tenantPhone: tenants.phone,
      tenantEmail: tenants.email,
      pageId: websitePages.id,
      pagePath: websitePages.path,
      pageTitle: websitePages.title,
      pageType: websitePages.pageType,
      pageSeo: websitePages.seoConfig,
      blocks: websitePageRevisions.blocks,
    })
    .from(websiteProjects)
    .innerJoin(websitePages, eq(websitePages.websiteProjectId, websiteProjects.id))
    .innerJoin(websitePageRevisions, eq(websitePageRevisions.websitePageId, websitePages.id))
    .leftJoin(tenants, eq(tenants.id, websiteProjects.ownerTenantId))
    .where(
      and(
        eq(websiteProjects.id, input.projectId),
        eq(websiteProjects.status, "published"),
        eq(websitePages.path, normalizedPath),
        eq(websitePageRevisions.state, "published")
      )
    )
    .orderBy(desc(websitePageRevisions.createdAt))
    .limit(1);

  if (!row) return null;

  const tenantHoursRows = row.tenantOpeningHours
    ? openingHoursToDisplayRows(normalizeWeekSchedule(row.tenantOpeningHours as DaySchedule[])).map((r) => ({ days: r.day, time: r.time }))
    : null;

  const tenantContactInfo = row.tenantAddress || row.tenantPhone || row.tenantEmail
    ? { address: row.tenantAddress, city: row.tenantCity, phone: row.tenantPhone, email: row.tenantEmail }
    : null;

  return {
    project: {
      id: row.projectId,
      name: row.projectName,
      slug: row.projectSlug,
      status: row.projectStatus,
      primaryDomain: row.primaryDomain,
      layoutKey: row.layoutKey,
      themeConfig: normalizeThemeConfig(row.themeConfig),
      capabilities: normalizeCapabilities(row.capabilities),
      seoConfig: websiteProjectSeoSchema.partial().catch({}).parse(row.projectSeo ?? {}),
      ownerTenantId: row.ownerTenantId,
      tenantHoursRows,
      tenantContactInfo,
      customCss: row.customCss,
    },
    page: {
      id: row.pageId,
      path: row.pagePath,
      title: row.pageTitle,
      pageType: row.pageType,
      seoConfig: websiteProjectSeoSchema.partial().catch({}).parse(row.pageSeo ?? {}),
    },
    blocks: normalizeBlocks(row.blocks),
  };
}
