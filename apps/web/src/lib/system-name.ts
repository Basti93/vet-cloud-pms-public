function stripProtocol(value: string) {
  return value.replace(/^https?:\/\//, "").replace(/\/$/, "");
}

export function getSystemDomain(): string {
  const explicitName = process.env.NEXT_PUBLIC_SYSTEM_NAME?.trim();
  if (explicitName) {
    return explicitName;
  }

  const raw =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.WEB_API_URL?.trim() ||
    "";

  if (!raw) {
    if (typeof window !== "undefined" && window.location?.host) {
      return window.location.host;
    }
    return "localhost";
  }

  try {
    return new URL(raw).host;
  } catch {
    return stripProtocol(raw);
  }
}
