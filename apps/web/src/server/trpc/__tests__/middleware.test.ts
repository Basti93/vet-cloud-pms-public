import { describe, it, expect, vi, beforeEach } from "vitest";
import { requirePermission } from "@/server/trpc/middleware";
import { TRPCError } from "@trpc/server";

vi.mock("@/lib/auth/permissions", () => ({
  getUserPermissions: vi.fn(),
}));

import { getUserPermissions } from "@/lib/auth/permissions";
const mockGetUserPermissions = vi.mocked(getUserPermissions);

function makeCtx(overrides: Record<string, unknown> = {}) {
  return {
    userId: "clerk-user-1",
    permissionCache: undefined as Set<string> | undefined,
    ...overrides,
  };
}

function makeNext() {
  return vi.fn().mockResolvedValue({ ok: true });
}

describe("requirePermission", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("throws UNAUTHORIZED when userId is missing", async () => {
    const middleware = requirePermission("medical:read");
    const ctx = makeCtx({ userId: null });
    await expect(middleware({ ctx, next: makeNext() })).rejects.toThrow(
      new TRPCError({ code: "UNAUTHORIZED", message: "User not authenticated" })
    );
  });

  it("throws FORBIDDEN when user lacks the required permission", async () => {
    mockGetUserPermissions.mockResolvedValue(new Set(["appointments:read"]));
    const middleware = requirePermission("medical:read");
    await expect(middleware({ ctx: makeCtx(), next: makeNext() })).rejects.toThrow(
      new TRPCError({ code: "FORBIDDEN", message: "Missing permission: medical:read" })
    );
  });

  it("calls next() when user has the required permission", async () => {
    mockGetUserPermissions.mockResolvedValue(new Set(["medical:read", "appointments:read"]));
    const middleware = requirePermission("medical:read");
    const next = makeNext();
    await middleware({ ctx: makeCtx(), next });
    expect(next).toHaveBeenCalledOnce();
  });

  it("fetches permissions from DB on cache miss and caches them", async () => {
    mockGetUserPermissions.mockResolvedValue(new Set(["medical:read"]));
    const middleware = requirePermission("medical:read");
    const ctx = makeCtx();

    await middleware({ ctx, next: makeNext() });

    expect(mockGetUserPermissions).toHaveBeenCalledOnce();
    expect(ctx.permissionCache).toBeInstanceOf(Set);
    expect(ctx.permissionCache?.has("medical:read")).toBe(true);
  });

  it("uses cached permission set and skips DB on cache hit", async () => {
    const middleware = requirePermission("medical:read");
    const ctx = makeCtx({ permissionCache: new Set(["medical:read"]) });

    await middleware({ ctx, next: makeNext() });

    expect(mockGetUserPermissions).not.toHaveBeenCalled();
  });

  it("uses cached set for rejection too — no extra DB call", async () => {
    const middleware = requirePermission("medical:create");
    const ctx = makeCtx({ permissionCache: new Set(["medical:read"]) });

    await expect(middleware({ ctx, next: makeNext() })).rejects.toThrow(TRPCError);
    expect(mockGetUserPermissions).not.toHaveBeenCalled();
  });

  it("propagates the return value of next()", async () => {
    mockGetUserPermissions.mockResolvedValue(new Set(["medical:read"]));
    const middleware = requirePermission("medical:read");
    const next = vi.fn().mockResolvedValue({ data: "procedure result" });

    const result = await middleware({ ctx: makeCtx(), next });
    expect(result).toEqual({ data: "procedure result" });
  });
});

describe("requirePermission — MEDICAL_READ guard on list procedures", () => {
  it("blocks MEDICAL_READ check for user with only appointments:read", async () => {
    mockGetUserPermissions.mockResolvedValue(new Set(["appointments:read"]));
    const guard = requirePermission("medical:read");
    await expect(guard({ ctx: makeCtx(), next: makeNext() })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("allows MEDICAL_READ check for user with medical:read", async () => {
    mockGetUserPermissions.mockResolvedValue(new Set(["medical:read"]));
    const guard = requirePermission("medical:read");
    const next = makeNext();
    await expect(guard({ ctx: makeCtx(), next })).resolves.toBeDefined();
    expect(next).toHaveBeenCalled();
  });

  it("MEDICAL_CREATE does not imply MEDICAL_READ", async () => {
    mockGetUserPermissions.mockResolvedValue(new Set(["medical:create", "medical:update"]));
    const guard = requirePermission("medical:read");
    await expect(guard({ ctx: makeCtx(), next: makeNext() })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
});
