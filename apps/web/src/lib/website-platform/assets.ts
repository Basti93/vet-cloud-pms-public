export function resolveAssetUrl(ref?: { url?: string; assetId?: string } | null, assetMap?: Record<string, string>) {
  if (!ref) return undefined;
  if (ref.assetId && assetMap?.[ref.assetId]) return assetMap[ref.assetId];
  return ref.url;
}

export function collectAssetIds(value: unknown): string[] {
  const ids: string[] = [];
  const visit = (node: unknown) => {
    if (!node || typeof node !== "object") return;
    if ("assetId" in node && typeof (node as { assetId?: unknown }).assetId === "string") ids.push((node as { assetId: string }).assetId);
    if (Array.isArray(node)) node.forEach(visit);
    else Object.values(node as Record<string, unknown>).forEach(visit);
  };
  visit(value);
  return ids;
}
