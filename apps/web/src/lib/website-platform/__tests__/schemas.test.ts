import { describe, it, expect } from "vitest";
import {
  normalizeThemeConfig,
  normalizeCapabilities,
  normalizeBlocks,
} from "@/lib/website-platform/schemas";

describe("normalizeThemeConfig", () => {
  it("returns all defaults for null input", () => {
    const cfg = normalizeThemeConfig(null);
    expect(cfg.palette).toBe("sage");
    expect(cfg.typography).toBe("modern");
    expect(cfg.radius).toBe("lg");
    expect(cfg.density).toBe("comfortable");
    expect(cfg.inheritTenantTheme).toBe(true);
  });

  it("returns all defaults for empty object", () => {
    const cfg = normalizeThemeConfig({});
    expect(cfg.palette).toBe("sage");
    expect(cfg.typography).toBe("modern");
  });

  it("preserves valid partial override", () => {
    const cfg = normalizeThemeConfig({ palette: "bordeaux", radius: "sm" });
    expect(cfg.palette).toBe("bordeaux");
    expect(cfg.radius).toBe("sm");
    expect(cfg.typography).toBe("modern"); // still defaulted
  });

  it("falls back to defaults for invalid enum value", () => {
    const cfg = normalizeThemeConfig({ palette: "not-a-color" });
    expect(cfg.palette).toBe("sage"); // .catch() handles parse failure
  });
});

describe("normalizeCapabilities", () => {
  it("returns defaults for null input — booking disabled", () => {
    const caps = normalizeCapabilities(null);
    expect(caps.booking.enabled).toBe(false);
    expect(caps.contactForm.enabled).toBe(true);
    expect(caps.teamProfiles.enabled).toBe(true);
  });

  it("preserves booking enabled flag", () => {
    const caps = normalizeCapabilities({ booking: { enabled: true, mode: "pms", tenantSlug: "my-clinic" } });
    expect(caps.booking.enabled).toBe(true);
    expect(caps.booking.mode).toBe("pms");
  });
});

describe("normalizeBlocks", () => {
  it("returns empty array for null", () => {
    expect(normalizeBlocks(null)).toEqual([]);
  });

  it("returns empty array for non-array garbage input", () => {
    expect(normalizeBlocks("garbage")).toEqual([]);
    expect(normalizeBlocks(42)).toEqual([]);
    expect(normalizeBlocks({ key: "val" })).toEqual([]);
  });

  it("parses valid hero block", () => {
    const blocks = normalizeBlocks([
      { id: "hero-1", type: "hero", props: { title: "Willkommen" } },
    ]);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe("hero");
  });

  it("returns empty array when block type is unknown (discriminated union fails, .catch kicks in)", () => {
    const blocks = normalizeBlocks([{ id: "x", type: "unknown-type", props: {} }]);
    expect(blocks).toEqual([]);
  });
});
