import { describe, it, expect } from "vitest";
import {
  isCapabilityEnabled,
  getBookingUrl,
} from "@/lib/website-platform/capabilities";
import { capabilityConfigSchema } from "@/lib/website-platform/schemas";
import type { WebsiteCapabilityConfig } from "@/lib/website-platform/types";

const makeConfig = (bookingOverride: Partial<WebsiteCapabilityConfig["booking"]> = {}): WebsiteCapabilityConfig =>
  capabilityConfigSchema.parse({ booking: { enabled: false, mode: "pms", ...bookingOverride } });

describe("isCapabilityEnabled", () => {
  it("returns true when capability is enabled", () => {
    const config = makeConfig({ enabled: true });
    expect(isCapabilityEnabled(config, "booking")).toBe(true);
  });

  it("returns false when capability is disabled", () => {
    const config = makeConfig({ enabled: false });
    expect(isCapabilityEnabled(config, "booking")).toBe(false);
  });

  it("returns false when capability is undefined", () => {
    const config = makeConfig();
    // @ts-expect-error intentional unknown key test
    expect(isCapabilityEnabled(config, "nonexistent")).toBe(false);
  });
});

describe("getBookingUrl", () => {
  it("returns null when booking is disabled", () => {
    expect(getBookingUrl(makeConfig({ enabled: false }))).toBeNull();
  });

  it("returns PMS booking path when mode is pms and tenantSlug is set", () => {
    const config = makeConfig({ enabled: true, mode: "pms", tenantSlug: "muster-tierklinik" });
    expect(getBookingUrl(config)).toBe("/book/muster-tierklinik");
  });

  it("returns external URL when mode is external and externalUrl is set", () => {
    const config = makeConfig({ enabled: true, mode: "external", externalUrl: "https://book.example.com" });
    expect(getBookingUrl(config)).toBe("https://book.example.com");
  });

  it("returns null when pms mode has no tenantSlug", () => {
    const config = makeConfig({ enabled: true, mode: "pms" });
    expect(getBookingUrl(config)).toBeNull();
  });

  it("returns null when external mode has no externalUrl", () => {
    const config = makeConfig({ enabled: true, mode: "external" });
    expect(getBookingUrl(config)).toBeNull();
  });
});
