/**
 * Environment detection.
 *
 * Set NEXT_PUBLIC_APP_ENV in Coolify:
 *   production apps → "production"
 *   staging apps    → "staging"
 *   (local dev)     → unset, falls through to NODE_ENV check
 */

export function isProduction(): boolean {
  return process.env.NEXT_PUBLIC_APP_ENV === "production";
}

export function isDevelopment(): boolean {
  return process.env.NODE_ENV === "development";
}

export function isStaging(): boolean {
  return process.env.NEXT_PUBLIC_APP_ENV === "staging";
}

export function getEnvironmentLabel(): string {
  if (isStaging()) return "Staging";
  if (isDevelopment()) return "Development";
  if (isProduction()) return "Production";
  return "Unknown";
}

export function getMainDomain(): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!appUrl) {
    throw new Error("NEXT_PUBLIC_APP_URL is required.");
  }

  return appUrl.replace(/\/$/, "");
}
