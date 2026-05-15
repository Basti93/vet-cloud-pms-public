import { redirect, notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db/client';
import { tenants, websiteProjects, users } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { resolvePublishedWebsitePage } from '@/lib/website-platform/resolve-project';
import { collectAssetIds } from '@/lib/website-platform/assets';
import { loadAssetUrlMap } from '@/lib/website-platform/assets-server';
import { PageRenderer } from '@/components/website-platform/renderer/PageRenderer';

interface Props {
  params: Promise<{ practiceSlug: string }>;
  searchParams: Promise<{ preview?: string }>;
}

async function getTenantData(practiceSlug: string) {
  const [row] = await db
    .select({
      tenantId: tenants.id,
      tenantName: tenants.name,
      projectId: websiteProjects.id,
      primaryDomain: websiteProjects.primaryDomain,
      websiteEnabled: tenants.websiteEnabled,
      previewToken: tenants.previewToken,
    })
    .from(tenants)
    .leftJoin(websiteProjects, eq(websiteProjects.ownerTenantId, tenants.id))
    .where(eq(tenants.slug, practiceSlug))
    .limit(1);
  return row ?? null;
}

async function isAuthenticatedMember(tenantId: string): Promise<boolean> {
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
  const { practiceSlug } = await params;
  const { preview } = await searchParams;
  const row = await getTenantData(practiceSlug);
  if (!row) return {};

  const isPublic = row.websiteEnabled;
  const isPreview = preview && row.previewToken && preview === row.previewToken;

  if (!isPublic && !isPreview) {
    return {
      title: row.tenantName,
      robots: { index: false, follow: false },
    };
  }

  return { title: row.tenantName };
}

export default async function PracticeWebsitePage({ params, searchParams }: Props) {
  const { practiceSlug } = await params;
  const { preview } = await searchParams;

  const row = await getTenantData(practiceSlug);

  if (!row) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Praxis nicht gefunden</h1>
          <p className="text-gray-500">Die angeforderte Praxis existiert nicht.</p>
        </div>
      </div>
    );
  }

  if (!row.websiteEnabled) {
    const isPreviewValid = preview && row.previewToken && preview === row.previewToken;
    const isMember = isPreviewValid ? false : await isAuthenticatedMember(row.tenantId);

    if (!isPreviewValid && !isMember) {
      notFound();
    }
  }

  const project = row.projectId ? { id: row.projectId, primaryDomain: row.primaryDomain } : null;

  if (!project) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Website in Vorbereitung</h1>
          <p className="text-gray-500">Diese Praxis-Website ist noch nicht eingerichtet.</p>
        </div>
      </div>
    );
  }

  const resolved = await resolvePublishedWebsitePage({ projectId: project.id, path: '/' });

  if (!resolved) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Website im Entwurf</h1>
          <p className="text-gray-500">Diese Praxis-Website ist aktuell nicht veröffentlicht.</p>
        </div>
      </div>
    );
  }

  if (project.primaryDomain) {
    redirect(`https://${project.primaryDomain}`);
  }

  const assetMap = await loadAssetUrlMap(collectAssetIds(resolved.blocks));
  return <PageRenderer resolved={resolved} assetMap={assetMap} />;
}
