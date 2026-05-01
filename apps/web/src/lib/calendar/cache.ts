import { appointmentEvents, type AppointmentChangeEvent } from '@/lib/events/appointment';

/**
 * Calendar Feed Cache
 *
 * Stores generated ICS feeds in memory with automatic invalidation
 * when appointments are created, updated, or deleted.
 *
 * Cache key format: `${tenantId}:${vetId}`
 * Cache entry includes: { ics: string, generatedAt: Date, expiresAt: Date }
 *
 * TTL: 15 minutes (default), invalidated immediately on appointment changes
 */

interface CacheEntry {
  ics: string;
  generatedAt: Date;
  expiresAt: Date;
}

const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes
const cache = new Map<string, CacheEntry>();

/**
 * Generate a cache key from tenant and vet IDs
 */
function getCacheKey(tenantId: string, vetId: string): string {
  return `${tenantId}:${vetId}`;
}

/**
 * Get cached ICS feed if it exists and hasn't expired
 */
export function getCachedICS(tenantId: string, vetId: string): string | null {
  const key = getCacheKey(tenantId, vetId);
  const entry = cache.get(key);

  if (!entry) {
    return null;
  }

  // Check if cache has expired
  if (new Date() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }

  return entry.ics;
}

/**
 * Set (or update) cached ICS feed
 */
export function setCachedICS(tenantId: string, vetId: string, ics: string): void {
  const key = getCacheKey(tenantId, vetId);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + CACHE_TTL_MS);

  cache.set(key, {
    ics,
    generatedAt: now,
    expiresAt,
  });
}

/**
 * Invalidate all cache entries for a tenant
 * Called when any appointment in that tenant changes
 */
function invalidateTenantCache(tenantId: string): void {
  const keysToDelete: string[] = [];

  for (const key of cache.keys()) {
    if (key.startsWith(`${tenantId}:`)) {
      keysToDelete.push(key);
    }
  }

  keysToDelete.forEach((key) => cache.delete(key));
}

/**
 * Initialize event listeners for cache invalidation
 * Call this once on server startup
 */
export function initializeCacheInvalidation(): void {
  appointmentEvents.onAnyChange((event: AppointmentChangeEvent) => {
    // Invalidate the tenant's cache when any appointment changes
    invalidateTenantCache(event.tenantId);

    // Log cache invalidation (optional, for debugging)
    console.log(
      `[Cache] Invalidated calendar feed for tenant ${event.tenantId} due to appointment ${event.type}`
    );
  });
}

/**
 * Clear all cache (useful for testing or manual cache clearing)
 */
export function clearAllCache(): void {
  cache.clear();
}

/**
 * Get cache stats (for monitoring/debugging)
 */
export function getCacheStats() {
  return {
    size: cache.size,
    entries: Array.from(cache.entries()).map(([key, entry]) => ({
      key,
      generatedAt: entry.generatedAt,
      expiresAt: entry.expiresAt,
      isExpired: new Date() > entry.expiresAt,
    })),
  };
}
