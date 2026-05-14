import { db } from "@/lib/db/client";
import { roles, tenants, userRoles, users, websiteDomains, websitePageRevisions, websitePages, websiteProjects } from "@/lib/db/schema";
import { and, asc, desc, eq } from "drizzle-orm";
import { normalizeBlocks, normalizeCapabilities, normalizeThemeConfig, websiteProjectSeoSchema } from "./schemas";
import type { ResolvedWebsitePage } from "./types";
import { openingHoursToDisplayRows, normalizeWeekSchedule, type DaySchedule } from "@/lib/schedule-types";

type TenantSpecialHours = NonNullable<ResolvedWebsitePage["project"]["tenantSpecialHours"]>;

function normalizeSpecialHours(value: unknown): TenantSpecialHours | null {
  if (!Array.isArray(value)) return null;
  const entries = value.flatMap((entry, index): TenantSpecialHours => {
    if (!entry || typeof entry !== "object") return [];
    const raw = entry as {
      id?: unknown;
      title?: unknown;
      startsOn?: unknown;
      endsOn?: unknown;
      note?: unknown;
      rows?: unknown;
    };
    const rows = Array.isArray(raw.rows)
      ? raw.rows.flatMap((row): { days: string; time: string }[] => {
          if (!row || typeof row !== "object") return [];
          const candidate = row as { days?: unknown; time?: unknown };
          return typeof candidate.days === "string" && typeof candidate.time === "string"
            ? [{ days: candidate.days, time: candidate.time }]
            : [];
        })
      : [];
    if (rows.length === 0) return [];
    return [{
      id: typeof raw.id === "string" ? raw.id : `special-hours-${index}`,
      title: typeof raw.title === "string" ? raw.title : "Abweichende Öffnungszeiten",
      startsOn: typeof raw.startsOn === "string" ? raw.startsOn : undefined,
      endsOn: typeof raw.endsOn === "string" ? raw.endsOn : undefined,
      note: typeof raw.note === "string" ? raw.note : undefined,
      rows,
    }];
  });
  return entries.length > 0 ? entries : null;
}

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
      logoAsset: websiteProjects.logoAsset,
      customCss: websiteProjects.customCss,
      capabilities: websiteProjects.capabilities,
      projectSeo: websiteProjects.seoConfig,
      ownerTenantId: websiteProjects.ownerTenantId,
      tenantOpeningHours: tenants.openingHours,
      tenantConsultationHours: tenants.consultationHours,
      tenantSpecialOpeningHours: tenants.specialOpeningHours,
      tenantAddress: tenants.address,
      tenantCity: tenants.city,
      tenantPhone: tenants.phone,
      tenantEmail: tenants.email,
      tenantMonogram: tenants.monogram,
      tenantThemePreference: tenants.themePreference,
      tenantTypographyPreference: tenants.typographyPreference,
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

  const teamMembers = row.ownerTenantId
    ? await db
        .select({ id: users.id, title: users.title, firstName: users.firstName, lastName: users.lastName })
        .from(users)
        .innerJoin(userRoles, eq(userRoles.userId, users.id))
        .innerJoin(roles, and(eq(roles.id, userRoles.roleId), eq(roles.tenantId, row.ownerTenantId), eq(roles.code, 'vet')))
        .where(and(eq(users.tenantId, row.ownerTenantId), eq(users.active, true)))
        .orderBy(asc(users.lastName), asc(users.firstName))
    : [];

  const tenantConsultationHoursRows = row.tenantConsultationHours
    ? openingHoursToDisplayRows(normalizeWeekSchedule(row.tenantConsultationHours as DaySchedule[])).map((r) => ({ days: r.day, time: r.time }))
    : null;
  const tenantOpeningHoursRows = row.tenantOpeningHours
    ? openingHoursToDisplayRows(normalizeWeekSchedule(row.tenantOpeningHours as DaySchedule[])).map((r) => ({ days: r.day, time: r.time }))
    : null;
  const tenantHoursRows = tenantConsultationHoursRows ?? tenantOpeningHoursRows;
  const tenantSpecialHours = normalizeSpecialHours(row.tenantSpecialOpeningHours);

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
      themeConfig: (() => {
        const base = normalizeThemeConfig(row.themeConfig);
        if (base.inheritTenantTheme !== false) {
          return {
            ...base,
            ...(row.tenantThemePreference ? { palette: row.tenantThemePreference as import('./types').WebsiteThemeConfig['palette'] } : {}),
            ...(row.tenantTypographyPreference ? { typography: row.tenantTypographyPreference as import('./types').WebsiteThemeConfig['typography'] } : {}),
          };
        }
        return base;
      })(),
      capabilities: normalizeCapabilities(row.capabilities),
      seoConfig: websiteProjectSeoSchema.partial().catch({}).parse(row.projectSeo ?? {}),
      ownerTenantId: row.ownerTenantId,
      tenantHoursRows,
      tenantConsultationHoursRows,
      tenantOpeningHoursRows,
      tenantSpecialHours,
      tenantContactInfo,
      logoAsset: row.logoAsset as import('./types').WebsiteAssetRef | null,
      customCss: row.customCss,
      tenantMonogram: row.tenantMonogram ?? null,
      teamMembers: teamMembers.map((m) => ({
        id: m.id,
        fullName: [m.title, m.firstName, m.lastName].filter(Boolean).join(' '),
        title: m.title,
      })),
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
