export function isProduction(): boolean {
  return process.env.NODE_ENV === "production" && process.env.VERCEL_ENV === "production";
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
