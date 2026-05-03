export function isProduction(): boolean {
  return process.env.VERCEL_ENV === "production" || process.env.NODE_ENV === "production";
}

export function isDevelopment(): boolean {
  return process.env.NODE_ENV === "development";
}

export function isPreview(): boolean {
  return process.env.VERCEL_ENV === "preview" || process.env.VERCEL_ENV === "development";
}

export function getEnvironmentLabel(): string {
  if (isProduction()) {
    return "Production";
  }
  if (isPreview()) {
    return "Preview";
  }
  if (isDevelopment()) {
    return "Development";
  }
  return "Unknown";
}

export function getMainDomain(): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!appUrl) {
    throw new Error("NEXT_PUBLIC_APP_URL is required.");
  }

  return appUrl.replace(/\/$/, "");
}
