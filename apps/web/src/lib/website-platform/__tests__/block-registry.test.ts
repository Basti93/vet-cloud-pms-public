import { describe, it, expect } from "vitest";
import {
  validateBlockProps,
  getDefaultBlock,
  WEBSITE_BLOCK_DEFINITIONS,
} from "@/lib/website-platform/block-registry";
import type { WebsiteBlockType } from "@/lib/website-platform/block-registry";

const ALL_BLOCK_TYPES = Object.keys(WEBSITE_BLOCK_DEFINITIONS) as WebsiteBlockType[];

describe("validateBlockProps", () => {
  it.each(ALL_BLOCK_TYPES)(
    "accepts empty input for block type '%s' and applies defaults",
    (type) => {
      expect(() => validateBlockProps(type, {})).not.toThrow();
      const result = validateBlockProps(type, {});
      expect(result).toBeDefined();
    }
  );

  it("hero block empty input gives default title", () => {
    const props = validateBlockProps("hero", {});
    expect((props as { title: string }).title).toBe("Willkommen");
  });

  it("servicesGrid empty input gives default heading", () => {
    const props = validateBlockProps("servicesGrid", {});
    expect((props as { heading: string }).heading).toBe("Unsere Leistungen");
  });

  it("throws for completely invalid type", () => {
    expect(() =>
      // @ts-expect-error intentional invalid type
      validateBlockProps("nonexistent-block", {})
    ).toThrow();
  });
});

describe("getDefaultBlock", () => {
  it("returns object with correct type field", () => {
    const block = getDefaultBlock("hero");
    expect(block.type).toBe("hero");
  });

  it("returns a string id", () => {
    const block = getDefaultBlock("richText");
    expect(typeof block.id).toBe("string");
    expect(block.id.length).toBeGreaterThan(0);
  });

  it("returns valid props for each block type", () => {
    for (const type of ALL_BLOCK_TYPES) {
      const block = getDefaultBlock(type);
      expect(block.type).toBe(type);
      expect(block.props).toBeDefined();
    }
  });

  it("hero default block has default title in props", () => {
    const block = getDefaultBlock("hero");
    expect((block.props as { title: string }).title).toBe("Willkommen");
  });
});
