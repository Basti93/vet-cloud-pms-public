import { describe, it, expect, afterEach, vi } from "vitest";
import {
  createUnsubscribeToken,
  verifyUnsubscribeToken,
  buildUnsubscribeUrl,
} from "@/lib/unsubscribe";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("createUnsubscribeToken", () => {
  it("returns a string with payload and signature separated by dot", () => {
    const token = createUnsubscribeToken("owner-123");
    expect(token).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
  });

  it("produces different tokens for different owner IDs", () => {
    const t1 = createUnsubscribeToken("owner-1");
    const t2 = createUnsubscribeToken("owner-2");
    expect(t1).not.toBe(t2);
  });
});

describe("verifyUnsubscribeToken", () => {
  it("round-trips owner ID through create and verify", () => {
    const token = createUnsubscribeToken("owner-abc");
    expect(verifyUnsubscribeToken(token)).toBe("owner-abc");
  });

  it("returns null for a tampered token", () => {
    const token = createUnsubscribeToken("owner-xyz");
    const [payload] = token.split(".");
    expect(verifyUnsubscribeToken(`${payload}.badsig`)).toBeNull();
  });

  it("returns null for malformed token with no dot separator", () => {
    expect(verifyUnsubscribeToken("nodot")).toBeNull();
  });

  it("returns null when signature part is missing", () => {
    expect(verifyUnsubscribeToken("payload.")).toBeNull();
  });
});

describe("buildUnsubscribeUrl", () => {
  it("uses provided baseUrl and encodes token", () => {
    const token = createUnsubscribeToken("owner-1");
    const url = buildUnsubscribeUrl("owner-1", "https://app.example.com");
    expect(url).toContain("https://app.example.com/api/unsubscribe?token=");
    expect(url).toContain(encodeURIComponent(token));
  });

  it("falls back to NEXT_PUBLIC_APP_URL env when no baseUrl given", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://env.example.com");
    const url = buildUnsubscribeUrl("owner-2");
    expect(url).toContain("https://env.example.com/api/unsubscribe?token=");
  });
});
