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

async function getTenantAccess(projectId: string) {
  const [row] = await db
    .select({ websiteEnabled: tenants.websiteEnabled, previewToken: tenants.previewToken, tenantId: tenants.id })
    .from(websiteProjects)
    .innerJoin(tenants, eq(tenants.id, websiteProjects.ownerTenantId))
    .where(eq(websiteProjects.id, projectId))
    .limit(1);
  return row ?? null;
}

async function canView(tenantId: string, previewToken: string | null | undefined, dbPreviewToken: string | null | undefined): Promise<boolean> {
  if (previewToken && dbPreviewToken && previewToken === dbPreviewToken) return true;
  const { userId } = await auth();
  if (!userId) return false;
  const [member] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.clerkId, userId), eq(users.tenantId, tenantId)))
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

  const access = await getTenantAccess(projectId);
  const robots = access && !access.websiteEnabled ? { index: false, follow: false } : undefined;
  return { title: resolved.project.name, ...(robots ? { robots } : {}) };
}

export default async function WebsiteProjectPublicPage({ params, searchParams }: Props) {
  const { siteSlug, sitePath } = await params;
  const { preview } = await searchParams;
  const headerList = await headers();
  const projectId = await resolveProjectByHostOrSlug({ slug: siteSlug, host: headerList.get('x-forwarded-host') ?? headerList.get('host') });
  if (!projectId) notFound();

  const access = await getTenantAccess(projectId);
  if (access && !access.websiteEnabled) {
    const allowed = await canView(access.tenantId, preview, access.previewToken);
    if (!allowed) notFound();
  }

  const path = sitePath?.length ? `/${sitePath.join('/')}` : '/';
  const resolved = await resolvePublishedWebsitePage({ projectId, path });
  if (!resolved) notFound();
  const assetMap = await loadAssetUrlMap(collectAssetIds([resolved.blocks, resolved.project.logoAsset]));
  return <PageRenderer resolved={resolved} assetMap={assetMap} previewToken={preview} />;
}
