import type { Metadata } from "next";
import type { ResolvedWebsitePage } from "./types";

export function buildWebsitePlatformMetadata(resolved: ResolvedWebsitePage, baseUrl: string): Metadata {
  const pageSeo = resolved.page.seoConfig ?? {};
  const projectSeo = resolved.project.seoConfig ?? {};
  const title = pageSeo.title ?? projectSeo.title ?? `${resolved.page.title} · ${resolved.project.name}`;
  const description = pageSeo.description ?? projectSeo.description ?? undefined;
  const canonical = pageSeo.canonicalUrl ?? projectSeo.canonicalUrl ?? `${baseUrl}${resolved.page.path}`;
  const robotsIndex = pageSeo.robotsIndex ?? projectSeo.robotsIndex ?? true;
  const ogImage = pageSeo.ogImage?.url ?? projectSeo.ogImage?.url;
  return {
    title,
    description,
    alternates: { canonical },
    robots: { index: robotsIndex, follow: robotsIndex },
    openGraph: { title, description, images: ogImage ? [{ url: ogImage }] : undefined },
  };
}
