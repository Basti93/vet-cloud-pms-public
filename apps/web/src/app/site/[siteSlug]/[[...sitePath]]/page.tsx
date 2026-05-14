import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import { PageRenderer } from '@/components/website-platform/renderer/PageRenderer';
import { collectAssetIds } from '@/lib/website-platform/assets';
import { loadAssetUrlMap } from '@/lib/website-platform/assets-server';
import { resolveProjectByHostOrSlug, resolvePublishedWebsitePage } from '@/lib/website-platform/resolve-project';

interface Props {
  params: Promise<{ siteSlug: string; sitePath?: string[] }>;
}

export default async function WebsiteProjectPublicPage({ params }: Props) {
  const { siteSlug, sitePath } = await params;
  const headerList = await headers();
  const projectId = await resolveProjectByHostOrSlug({ slug: siteSlug, host: headerList.get('x-forwarded-host') ?? headerList.get('host') });
  if (!projectId) notFound();
  const path = sitePath?.length ? `/${sitePath.join('/')}` : '/';
  const resolved = await resolvePublishedWebsitePage({ projectId, path });
  if (!resolved) notFound();
  const assetMap = await loadAssetUrlMap(collectAssetIds(resolved.blocks));
  return <PageRenderer resolved={resolved} assetMap={assetMap} />;
}
