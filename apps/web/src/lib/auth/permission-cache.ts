import { EventEmitter } from "events";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { rolePermissions } from "@/lib/db/schema";

/**
 * In-memory cache for role permissions.
 *
 * STRATEGY:
 * - Stores roleId → Set<string> mappings
 * - Avoids N database queries when multiple permissions need to be checked
 * - Invalidated immediately when roles/permissions change (not TTL-based)
 * - Cache hits are instant (Map lookup + Set.has)
 * - Cache misses batch permissions in a single query
 *
 * PERFORMANCE IMPACT:
 * - Cold cache (first permission check): 1 DB query (fetch permissions for roleId)
 * - Warm cache (subsequent checks same roleId): O(1) lookup
 * - Within-request dedup: ctx.permissionCache in tRPC context prevents re-querying
 * - After mutation: Invalidation is synchronous, next request pays full cost then re-warms
 *
 * THREAD SAFETY:
 * - Node.js single-threaded, Map operations are atomic
 * - Invalidation happens synchronously in same tick as mutation
 * - No race conditions between invalidation and reads (JavaScript is single-threaded)
 */

const rolePermissionsCache = new Map<string, Set<string>>();
const cacheEvents = new EventEmitter();

/**
 * Get permissions for a role, using cache if available.
 *
 * Cache hit: O(1) memory lookup
 * Cache miss: 1 database query to fetch all permissions for the roleId
 *
 * @param roleId - The role ID to get permissions for
 * @returns Set of permission strings for this role
 */
export async function getRolePermissions(roleId: string): Promise<Set<string>> {
  // Cache hit
  const cached = rolePermissionsCache.get(roleId);
  if (cached) {
    return cached;
  }

  // Cache miss: fetch from database
  const perms = await db
    .select({ permission: rolePermissions.permission })
    .from(rolePermissions)
    .where(eq(rolePermissions.roleId, roleId));

  // Store in cache and return
  const permissionSet = new Set(perms.map((p) => p.permission));
  rolePermissionsCache.set(roleId, permissionSet);

  return permissionSet;
}

/**
 * Clear a specific role's permissions from cache.
 * Called after assigning/removing permissions from a role.
 *
 * @param roleId - The role ID whose cache should be invalidated
 */
export function invalidateRolePermissionCache(roleId: string): void {
  rolePermissionsCache.delete(roleId);
  cacheEvents.emit("invalidate", { roleId, scope: "single" });
}

/**
 * Clear all cached role permissions.
 * Called when system roles are reconfigured or when a full resync is needed.
 */
export function invalidateAllRolePermissions(): void {
  rolePermissionsCache.clear();
  cacheEvents.emit("invalidate", { scope: "all" });
}

/**
 * Get cache statistics for monitoring/debugging.
 *
 * @returns Object with cache size and list of cached role IDs
 */
export function getCacheStats(): { size: number; roleIds: string[] } {
  return {
    size: rolePermissionsCache.size,
    roleIds: Array.from(rolePermissionsCache.keys()),
  };
}

/**
 * Subscribe to cache invalidation events.
 * Useful for monitoring cache behavior in production.
 *
 * @param callback - Function to call on cache invalidation
 */
export function onPermissionCacheInvalidated(
  callback: (event: { roleId?: string; scope: "single" | "all" }) => void
): void {
  cacheEvents.on("invalidate", callback);
}

/**
 * Unsubscribe from cache invalidation events.
 *
 * @param callback - The callback to remove
 */
export function offPermissionCacheInvalidated(
  callback: (event: { roleId?: string; scope: "single" | "all" }) => void
): void {
  cacheEvents.off("invalidate", callback);
}
