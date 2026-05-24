import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  invalidateAllRolePermissions,
  invalidateRolePermissionCache,
  getCacheStats,
  onPermissionCacheInvalidated,
  offPermissionCacheInvalidated,
} from "@/lib/auth/permission-cache";

beforeEach(() => {
  invalidateAllRolePermissions();
});

describe("getCacheStats", () => {
  it("returns empty stats on fresh module", () => {
    const stats = getCacheStats();
    expect(stats.size).toBe(0);
    expect(stats.roleIds).toEqual([]);
  });
});

describe("invalidateAllRolePermissions", () => {
  it("emits invalidate event with scope all", () => {
    const handler = vi.fn();
    onPermissionCacheInvalidated(handler);
    invalidateAllRolePermissions();
    expect(handler).toHaveBeenCalledWith({ scope: "all" });
    offPermissionCacheInvalidated(handler);
  });

  it("does not throw on empty cache", () => {
    expect(() => invalidateAllRolePermissions()).not.toThrow();
  });
});

describe("invalidateRolePermissionCache", () => {
  it("emits invalidate event with single scope and roleId", () => {
    const handler = vi.fn();
    onPermissionCacheInvalidated(handler);
    invalidateRolePermissionCache("role-abc");
    expect(handler).toHaveBeenCalledWith({ roleId: "role-abc", scope: "single" });
    offPermissionCacheInvalidated(handler);
  });

  it("does not throw when key does not exist in cache", () => {
    expect(() => invalidateRolePermissionCache("non-existent-role")).not.toThrow();
  });
});

describe("onPermissionCacheInvalidated / offPermissionCacheInvalidated", () => {
  it("receives events after subscribe and stops after unsubscribe", () => {
    const handler = vi.fn();
    onPermissionCacheInvalidated(handler);
    invalidateAllRolePermissions();
    expect(handler).toHaveBeenCalledTimes(1); // 1 from this call (beforeEach also ran but handler wasn't registered yet)

    offPermissionCacheInvalidated(handler);
    invalidateAllRolePermissions();
    expect(handler).toHaveBeenCalledTimes(1); // no new calls
  });

  it("multiple handlers receive the same event", () => {
    const h1 = vi.fn();
    const h2 = vi.fn();
    onPermissionCacheInvalidated(h1);
    onPermissionCacheInvalidated(h2);

    invalidateRolePermissionCache("role-xyz");

    expect(h1).toHaveBeenCalledWith({ roleId: "role-xyz", scope: "single" });
    expect(h2).toHaveBeenCalledWith({ roleId: "role-xyz", scope: "single" });

    offPermissionCacheInvalidated(h1);
    offPermissionCacheInvalidated(h2);
  });
});
