import { describe, it, expect, afterEach, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("getSystemDomain", () => {
  it("returns NEXT_PUBLIC_SYSTEM_NAME when set", async () => {
    vi.stubEnv("NEXT_PUBLIC_SYSTEM_NAME", "test.example.com");
    // Re-import after stubbing env — module caches nothing at load time
    const { getSystemDomain } = await import("@/lib/system-name");
    expect(getSystemDomain()).toBe("test.example.com");
  });

  it("extracts host from NEXT_PUBLIC_APP_URL when no explicit name", async () => {
    vi.stubEnv("NEXT_PUBLIC_SYSTEM_NAME", "");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://app.example.com");
    const { getSystemDomain } = await import("@/lib/system-name");
    expect(getSystemDomain()).toBe("app.example.com");
  });

  it("falls back to a localhost-based value when no env vars are set", async () => {
    vi.stubEnv("NEXT_PUBLIC_SYSTEM_NAME", "");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
    vi.stubEnv("WEB_API_URL", "");
    const { getSystemDomain } = await import("@/lib/system-name");
    // jsdom sets window.location.host so the window fallback kicks in
    expect(getSystemDomain()).toMatch(/^localhost/);
  });

  it("handles malformed URL by stripping protocol manually", async () => {
    vi.stubEnv("NEXT_PUBLIC_SYSTEM_NAME", "");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "not-a-valid-url");
    vi.stubEnv("WEB_API_URL", "");
    const { getSystemDomain } = await import("@/lib/system-name");
    expect(getSystemDomain()).toBe("not-a-valid-url");
  });
});
