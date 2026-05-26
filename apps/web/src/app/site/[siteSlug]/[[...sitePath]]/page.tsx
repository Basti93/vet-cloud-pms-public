import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import { auth } from '@clerk/nextjs/server';
import type { Metadata } from 'next';
import { PageRenderer } from '@/components/website-platform/renderer/PageRenderer';
import { collectAssetIds } from '@/lib/website-platform/assets';
import { loadAssetUrlMap } from '@/lib/website-platform/assets-server';
import { resolveProjectByHostOrSlug, resolvePublishedWebsitePage } from '@/lib/website-platform/resolve-project';
import { db } from '@/lib/db/client';
import { tenants, websiteProjects, users } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

interface Props {
  params: Promise<{ siteSlug: string; sitePath?: string[] }>;
  searchParams: Promise<{ preview?: string }>;
}

interface AccessInfo {
  ownerType: 'tenant' | 'standalone';
  websiteEnabled: boolean | null;
  tenantId: string | null;
  // token from tenant row (tenant projects) or project row (standalone projects)
  previewToken: string | null;
}

async function getAccessInfo(projectId: string): Promise<AccessInfo | null> {
  const [row] = await db
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

  const isStandalone = row.ownerType === 'standalone';
  return {
    ownerType: row.ownerType as 'tenant' | 'standalone',
    // standalone projects are never publicly enabled
    websiteEnabled: isStandalone ? false : (row.websiteEnabled ?? false),
    tenantId: row.tenantId,
    previewToken: isStandalone ? row.projectPreviewToken : row.tenantPreviewToken,
  };
}

async function canView(access: AccessInfo, urlToken: string | null | undefined): Promise<boolean> {
  if (urlToken && access.previewToken && urlToken === access.previewToken) return true;
  // standalone projects: only preview token grants access, no Clerk fallback
  if (access.ownerType === 'standalone') return false;
  if (!access.tenantId) return false;
  const { userId } = await auth();
  if (!userId) return false;
  const [member] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.clerkId, userId), eq(users.tenantId, access.tenantId)))
    .limit(1);
  return Boolean(member);
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { siteSlug, sitePath } = await params;
  const { preview } = await searchParams;
  const headerList = await headers();
  const projectId = await resolveProjectByHostOrSlug({ slug: siteSlug, host: headerList.get('x-forwarded-host') ?? headerList.get('host') });
  if (!projectId) return {};
  const path = sitePath?.length ? `/${sitePath.join('/')}` : '/';
  const resolved = await resolvePublishedWebsitePage({ projectId, path });
  if (!resolved) return {};

  const access = await getAccessInfo(projectId);
  // noindex for disabled tenant sites and all standalone prospect sites
  const noindex = access && (!access.websiteEnabled || access.ownerType === 'standalone');
  return {
    title: resolved.project.name,
    ...(noindex ? { robots: { index: false, follow: false } } : {}),
  };
}

export default async function WebsiteProjectPublicPage({ params, searchParams }: Props) {
  const { siteSlug, sitePath } = await params;
  const { preview } = await searchParams;
  const headerList = await headers();
  const projectId = await resolveProjectByHostOrSlug({ slug: siteSlug, host: headerList.get('x-forwarded-host') ?? headerList.get('host') });
  if (!projectId) notFound();

  const access = await getAccessInfo(projectId);
  if (access && !access.websiteEnabled) {
    const allowed = await canView(access, preview);
    if (!allowed) notFound();
  }

  const path = sitePath?.length ? `/${sitePath.join('/')}` : '/';
  const resolved = await resolvePublishedWebsitePage({ projectId, path });
  if (!resolved) notFound();
  const assetMap = await loadAssetUrlMap(collectAssetIds([resolved.blocks, resolved.project.logoAsset]));
  return <PageRenderer resolved={resolved} assetMap={assetMap} previewToken={preview} />;
}
