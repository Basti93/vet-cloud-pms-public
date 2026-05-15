import { redirect } from 'next/navigation';
import { db } from '@/lib/db/client';
import { tenants, websiteProjects } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { resolvePublishedWebsitePage } from '@/lib/website-platform/resolve-project';
import { collectAssetIds } from '@/lib/website-platform/assets';
import { loadAssetUrlMap } from '@/lib/website-platform/assets-server';
import { PageRenderer } from '@/components/website-platform/renderer/PageRenderer';

interface Props {
  params: Promise<{ practiceSlug: string }>;
}

export default async function PracticeWebsitePage({ params }: Props) {
  const { practiceSlug } = await params;

  const [row] = await db
    .select({
      tenantId: tenants.id,
      projectId: websiteProjects.id,
      primaryDomain: websiteProjects.primaryDomain,
    })
    .from(tenants)
    .leftJoin(websiteProjects, eq(websiteProjects.ownerTenantId, tenants.id))
    .where(eq(tenants.slug, practiceSlug))
    .limit(1);

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
