import type { WebsiteCapabilityConfig } from "./types";

export function isCapabilityEnabled(config: WebsiteCapabilityConfig, key: keyof WebsiteCapabilityConfig) {
  const value = config[key] as { enabled?: boolean } | undefined;
  return Boolean(value?.enabled);
}

export function getBookingUrl(config: WebsiteCapabilityConfig) {
  if (!config.booking.enabled) return null;
  if (config.booking.mode === "pms" && config.booking.tenantSlug) return `/book/${config.booking.tenantSlug}`;
  if (config.booking.mode === "external" && config.booking.externalUrl) return config.booking.externalUrl;
  return null;
}
