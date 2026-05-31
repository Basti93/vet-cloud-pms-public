import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@clerk/nextjs/server";
import type { Metadata } from "next";
import { PageRenderer } from "@/components/website-platform/renderer/PageRenderer";
import { collectAssetIds } from "@/lib/website-platform/assets";
import { loadAssetUrlMap } from "@/lib/website-platform/assets-server";
import {
  resolveProjectByHostOrSlug,
  resolvePublishedWebsitePage,
} from "@/lib/website-platform/resolve-project";
import { canView, getAccessInfo, type AccessInfo } from "@/lib/public-route/site-access";

interface Props {
  params: Promise<{ siteSlug: string; sitePath?: string[] }>;
  searchParams: Promise<{ preview?: string }>;
}

export type { AccessInfo };
export { canView, getAccessInfo };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { siteSlug, sitePath } = await params;
  const headerList = await headers();
  const projectId = await resolveProjectByHostOrSlug({
    slug: siteSlug,
    host: headerList.get("x-forwarded-host") ?? headerList.get("host"),
  });
  if (!projectId) return {};
  const path = sitePath?.length ? `/${sitePath.join("/")}` : "/";
  const resolved = await resolvePublishedWebsitePage({ projectId, path });
  if (!resolved) return {};

  const access = await getAccessInfo(projectId);
  // noindex for disabled tenant sites and all standalone prospect sites
  const noindex = access && (!access.websiteEnabled || access.ownerType === "standalone");
  return {
    title: resolved.project.name,
    ...(noindex ? { robots: { index: false, follow: false } } : {}),
  };
}

export default async function WebsiteProjectPublicPage({ params, searchParams }: Props) {
  const { siteSlug, sitePath } = await params;
  const { preview } = await searchParams;
  const headerList = await headers();
  const projectId = await resolveProjectByHostOrSlug({
    slug: siteSlug,
    host: headerList.get("x-forwarded-host") ?? headerList.get("host"),
  });
  if (!projectId) notFound();

  const access = await getAccessInfo(projectId);
  if (access && !access.websiteEnabled) {
    const { userId } = await auth();
    const allowed = await canView(access, preview, { userId });
    if (!allowed) notFound();
  }

  const path = sitePath?.length ? `/${sitePath.join("/")}` : "/";
  const resolved = await resolvePublishedWebsitePage({ projectId, path });
  if (!resolved) return notFound();
  const assetMap = await loadAssetUrlMap(collectAssetIds([resolved.blocks, resolved.project.logoAsset]));
  return <PageRenderer resolved={resolved} assetMap={assetMap} previewToken={preview} />;
}
