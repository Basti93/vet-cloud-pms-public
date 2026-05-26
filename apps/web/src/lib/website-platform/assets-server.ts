import "server-only";

import { adminDb } from "@/lib/db/client";
import { websiteAssets } from "@/lib/db/schema";
import { inArray } from "drizzle-orm";

export async function loadAssetUrlMap(assetIds: string[]): Promise<Record<string, string>> {
  const unique = [...new Set(assetIds.filter(Boolean))];
  if (!unique.length) return {};
  const rows = await adminDb
    .select({ id: websiteAssets.id, url: websiteAssets.url })
    .from(websiteAssets)
    .where(inArray(websiteAssets.id, unique));
  return Object.fromEntries(rows.map((row) => [row.id, row.url]));
}
