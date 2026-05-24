import { describe, expect, it } from "vitest";
import {
  frameAncestorSourcesForDomain,
  isEmbeddingOriginAllowed,
  isRequestAllowedByEmbeddingDomains,
  normalizeEmbeddingDomain,
  normalizeEmbeddingDomains,
} from "@/lib/booking/embed-origin";

describe("booking embed origin helpers", () => {
  it("normalizes configured domains", () => {
    expect(normalizeEmbeddingDomain(" HTTPS://WWW.Example.DE/path ")).toBe("www.example.de");
    expect(normalizeEmbeddingDomains(["example.de", "https://example.de/path", "EXAMPLE.de"])).toEqual([
      "example.de",
    ]);
  });

  it("allows configured hostnames and www variants", () => {
    expect(isEmbeddingOriginAllowed("https://www.example.de/widget", ["example.de"])).toBe(true);
    expect(isEmbeddingOriginAllowed("https://example.de/widget", ["www.example.de"])).toBe(true);
    expect(isEmbeddingOriginAllowed("https://evil.test/widget", ["example.de"])).toBe(false);
  });

  it("checks request referer or origin headers against the allowlist", () => {
    expect(
      isRequestAllowedByEmbeddingDomains(
        new Headers({ referer: "https://practice.example/book" }),
        ["practice.example"]
      )
    ).toBe(true);

    expect(
      isRequestAllowedByEmbeddingDomains(
        new Headers({ origin: "https://outside.example" }),
        ["practice.example"]
      )
    ).toBe(false);
  });

  it("builds frame ancestor sources for local and public domains", () => {
    expect(frameAncestorSourcesForDomain("localhost")).toEqual(["http://localhost:*"]);
    expect(frameAncestorSourcesForDomain("example.de")).toEqual([
      "https://example.de",
      "https://www.example.de",
    ]);
  });

  it("handles 127.0.0.1 as local frame ancestor", () => {
    expect(frameAncestorSourcesForDomain("127.0.0.1")).toEqual(["http://127.0.0.1:*"]);
  });

  it("normalizeEmbeddingDomain returns null for empty string", () => {
    expect(normalizeEmbeddingDomain("   ")).toBeNull();
  });

  it("isRequestAllowedByEmbeddingDomains returns false when no referer or origin header", () => {
    expect(
      isRequestAllowedByEmbeddingDomains(new Headers(), ["practice.example"])
    ).toBe(false);
  });

  it("isRequestAllowedByEmbeddingDomains falls back to origin when referer absent", () => {
    expect(
      isRequestAllowedByEmbeddingDomains(
        new Headers({ origin: "https://practice.example" }),
        ["practice.example"]
      )
    ).toBe(true);
  });
});
