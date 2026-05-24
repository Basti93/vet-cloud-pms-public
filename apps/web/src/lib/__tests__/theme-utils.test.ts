import { describe, it, expect } from "vitest";
import {
  getPrimaryColor,
  getPrimaryHex,
  getTypography,
  generateThemeStyles,
} from "@/lib/theme-utils";

describe("getPrimaryColor", () => {
  it("returns accent CSS value for a known preset", () => {
    const color = getPrimaryColor("sage");
    expect(color).toContain("oklch");
  });

  it("falls back to sage for an unknown key", () => {
    const fallback = getPrimaryColor("unknown-key");
    const sage = getPrimaryColor("sage");
    expect(fallback).toBe(sage);
  });

  it("falls back to sage when null is passed", () => {
    expect(getPrimaryColor(null)).toBe(getPrimaryColor("sage"));
  });
});

describe("getPrimaryHex", () => {
  it("returns a hex color for a known preset", () => {
    const hex = getPrimaryHex("sage");
    expect(hex).toMatch(/^#[0-9a-fA-F]{6}$/);
  });

  it("falls back to sage hex for unknown key", () => {
    expect(getPrimaryHex("nope")).toBe(getPrimaryHex("sage"));
  });
});

describe("getTypography", () => {
  it("returns heading and body fonts for a known pairing", () => {
    const type = getTypography("modern");
    expect(type.heading).toBeTruthy();
    expect(type.body).toBeTruthy();
  });

  it("falls back to modern for an unknown key", () => {
    const fallback = getTypography("unknown");
    const modern = getTypography("modern");
    expect(fallback.heading).toBe(modern.heading);
  });

  it("falls back to modern when undefined is passed", () => {
    expect(getTypography(undefined).heading).toBe(getTypography("modern").heading);
  });
});

describe("generateThemeStyles", () => {
  it("returns an object with --color-accent CSS variable", () => {
    const styles = generateThemeStyles("sage", "modern");
    expect(styles).toHaveProperty("--color-accent");
  });

  it("uses default radius lg when no options provided", () => {
    const styles = generateThemeStyles("sage", "modern") as Record<string, string>;
    expect(styles["--radius-base"]).toBe("1rem");
  });

  it("applies custom radius from options", () => {
    const styles = generateThemeStyles("sage", "modern", { radius: "sm" }) as Record<string, string>;
    expect(styles["--radius-base"]).toBe("0.5rem");
  });

  it("applies density map correctly", () => {
    const compact = generateThemeStyles("sage", "modern", { density: "compact" }) as Record<string, string>;
    const spacious = generateThemeStyles("sage", "modern", { density: "spacious" }) as Record<string, string>;
    expect(compact["--spacing-section"]).toBe("3rem");
    expect(spacious["--spacing-section"]).toBe("5rem");
  });

  it("falls back to sage/modern for null/undefined inputs", () => {
    const styles = generateThemeStyles(null, undefined);
    expect(styles).toHaveProperty("--color-accent");
    expect(styles).toHaveProperty("--font-heading");
  });
});
