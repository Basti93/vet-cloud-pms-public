import { describe, it, expect, afterEach, vi } from "vitest";
import { getSystemDomain } from "@/lib/system-name";

// getSystemDomain() reads process.env at call time — vi.stubEnv patches are effective immediately
afterEach(() => {
  vi.unstubAllEnvs();
});

describe("getSystemDomain", () => {
  it("returns NEXT_PUBLIC_SYSTEM_NAME when set", () => {
    vi.stubEnv("NEXT_PUBLIC_SYSTEM_NAME", "test.example.com");
    expect(getSystemDomain()).toBe("test.example.com");
  });

  it("extracts host from NEXT_PUBLIC_APP_URL when no explicit name", () => {
    vi.stubEnv("NEXT_PUBLIC_SYSTEM_NAME", "");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://app.example.com");
    vi.stubEnv("WEB_API_URL", "");
    expect(getSystemDomain()).toBe("app.example.com");
  });

  it("falls back to a localhost-based value when no env vars set", () => {
    vi.stubEnv("NEXT_PUBLIC_SYSTEM_NAME", "");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
    vi.stubEnv("WEB_API_URL", "");
    // jsdom sets window.location.host, so function returns that instead of "localhost"
    expect(getSystemDomain()).toMatch(/^localhost/);
  });

  it("handles malformed URL gracefully", () => {
    vi.stubEnv("NEXT_PUBLIC_SYSTEM_NAME", "");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "not-a-valid-url");
    vi.stubEnv("WEB_API_URL", "");
    expect(getSystemDomain()).toBe("not-a-valid-url");
  });

  it("trims whitespace from NEXT_PUBLIC_SYSTEM_NAME", () => {
    vi.stubEnv("NEXT_PUBLIC_SYSTEM_NAME", "  spaced.example.com  ");
    expect(getSystemDomain()).toBe("spaced.example.com");
  });
});
