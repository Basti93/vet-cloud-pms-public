import type { z } from "zod";
import type {
  assetRefSchema,
  capabilityConfigSchema,
  pageBlockSchema,
  themeConfigSchema,
  websiteProjectSeoSchema,
} from "./schemas";

export type WebsiteOwnerType = "tenant" | "standalone";
export type WebsiteProjectStatus = "draft" | "published" | "archived";
export type WebsitePageType = "default" | "legal_impressum" | "legal_privacy" | "landing" | "booking";
export type WebsiteRevisionState = "draft" | "published";

export type WebsiteCapabilityConfig = z.infer<typeof capabilityConfigSchema>;
export type WebsiteThemeConfig = z.infer<typeof themeConfigSchema>;
export type WebsiteProjectSeo = z.infer<typeof websiteProjectSeoSchema>;
export type WebsiteAssetRef = z.infer<typeof assetRefSchema>;
export type WebsitePageBlock = z.infer<typeof pageBlockSchema>;

export interface WebsiteProjectSummary {
  id: string;
  name: string;
  slug: string;
  status: WebsiteProjectStatus;
  layoutKey: string;
  primaryDomain?: string | null;
  ownerType: WebsiteOwnerType;
}

export interface ResolvedWebsitePage {
  project: {
    id: string;
    name: string;
    slug: string;
    status: WebsiteProjectStatus;
    primaryDomain?: string | null;
    layoutKey: string;
    themeConfig: WebsiteThemeConfig;
    capabilities: WebsiteCapabilityConfig;
    seoConfig?: WebsiteProjectSeo | null;
    ownerTenantId?: string | null;
    tenantHoursRows?: { days: string; time: string }[] | null;
    tenantContactInfo?: { address?: string | null; phone?: string | null; email?: string | null; city?: string | null } | null;
  };
  page: {
    id: string;
    path: string;
    title: string;
    pageType: WebsitePageType;
    seoConfig?: WebsiteProjectSeo | null;
  };
  blocks: WebsitePageBlock[];
}
