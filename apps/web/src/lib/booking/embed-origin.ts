export function normalizeEmbeddingDomain(domain: string) {
  const trimmed = domain.trim().toLowerCase();
  if (!trimmed) return null;

  try {
    return new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`)
      .hostname;
  } catch {
    return trimmed.split("/")[0]?.split(":")[0] || null;
  }
}

export function normalizeEmbeddingDomains(domains: string[] | null | undefined) {
  return [
    ...new Set(
      (domains ?? [])
        .map((domain) => normalizeEmbeddingDomain(domain))
        .filter((domain): domain is string => Boolean(domain))
    ),
  ];
}

export function frameAncestorSourcesForDomain(domain: string) {
  if (domain === "localhost") {
    return ["http://localhost:*"];
  }

  if (domain === "127.0.0.1") {
    return ["http://127.0.0.1:*"];
  }

  return [`https://${domain}`, `https://www.${domain}`];
}

export function extractHostnameFromUrl(value: string | null | undefined) {
  if (!value) return null;
  try {
    return new URL(value).hostname.toLowerCase();
  } catch {
    return null;
  }
}

export function isHostnameAllowed(hostname: string, allowedDomains: string[]) {
  return allowedDomains.some((domain) => {
    if (domain === "localhost" || domain === "127.0.0.1") {
      return hostname === domain;
    }

    return (
      hostname === domain ||
      hostname === `www.${domain}` ||
      domain === `www.${hostname}`
    );
  });
}

export function isRequestAllowedByEmbeddingDomains(
  headers: Headers,
  allowedDomains: string[]
) {
  const refererHost = extractHostnameFromUrl(headers.get("referer"));
  const originHost = extractHostnameFromUrl(headers.get("origin"));
  const requestHost = refererHost ?? originHost;

  if (!requestHost) return false;
  return isHostnameAllowed(requestHost, allowedDomains);
}

export function isEmbeddingOriginAllowed(
  embeddingOrigin: string | null | undefined,
  allowedDomains: string[]
) {
  const embeddingHost = extractHostnameFromUrl(embeddingOrigin);
  if (!embeddingHost) return false;
  return isHostnameAllowed(embeddingHost, allowedDomains);
}
