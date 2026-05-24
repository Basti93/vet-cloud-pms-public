import { describe, it, expect } from "vitest";
import { createDefaultWebsiteBlocks } from "@/lib/website-platform/default-blocks";
import type { DaySchedule } from "@/lib/schedule-types";

const weekdays: DaySchedule[] = [
  { dayOfWeek: 0, slots: [] },
  { dayOfWeek: 1, slots: [{ startHour: 8, startMin: 0, endHour: 18, endMin: 0 }] },
  { dayOfWeek: 2, slots: [{ startHour: 8, startMin: 0, endHour: 18, endMin: 0 }] },
  { dayOfWeek: 3, slots: [{ startHour: 8, startMin: 0, endHour: 18, endMin: 0 }] },
  { dayOfWeek: 4, slots: [{ startHour: 8, startMin: 0, endHour: 18, endMin: 0 }] },
  { dayOfWeek: 5, slots: [{ startHour: 8, startMin: 0, endHour: 18, endMin: 0 }] },
  { dayOfWeek: 6, slots: [] },
];

describe("createDefaultWebsiteBlocks", () => {
  it("returns an array of blocks", () => {
    const blocks = createDefaultWebsiteBlocks({ practiceName: "Tierarzt Test" });
    expect(Array.isArray(blocks)).toBe(true);
    expect(blocks.length).toBeGreaterThan(0);
  });

  it("includes a hero block with practiceName in title", () => {
    const blocks = createDefaultWebsiteBlocks({ practiceName: "Muster Praxis" });
    const hero = blocks.find((b) => b.type === "hero");
    expect(hero).toBeDefined();
    expect((hero!.props as { title: string }).title).toContain("Muster Praxis");
  });

  it("includes a servicesGrid block", () => {
    const blocks = createDefaultWebsiteBlocks({ practiceName: "Test" });
    expect(blocks.some((b) => b.type === "servicesGrid")).toBe(true);
  });

  it("includes a hoursTable block", () => {
    const blocks = createDefaultWebsiteBlocks({ practiceName: "Test" });
    expect(blocks.some((b) => b.type === "hoursTable")).toBe(true);
  });

  it("includes a contactCard block", () => {
    const blocks = createDefaultWebsiteBlocks({ practiceName: "Test" });
    expect(blocks.some((b) => b.type === "contactCard")).toBe(true);
  });

  it("includes a bookingCta block", () => {
    const blocks = createDefaultWebsiteBlocks({ practiceName: "Test" });
    expect(blocks.some((b) => b.type === "bookingCta")).toBe(true);
  });

  it("hoursTable sections reflect consultationHours input", () => {
    const blocks = createDefaultWebsiteBlocks({
      practiceName: "Test",
      consultationHours: weekdays,
    });
    const hours = blocks.find((b) => b.type === "hoursTable");
    const props = hours?.props as { sections: Array<{ rows: Array<{ days: string; time: string }> }> };
    expect(props?.sections?.length).toBeGreaterThan(0);
    // Mo–Fr 08:00–18:00 should be grouped into one row
    const allRows = props.sections.flatMap((s) => s.rows);
    expect(allRows.some((r) => r.time.includes("08:00"))).toBe(true);
  });

  it("does not crash with all optional fields omitted", () => {
    expect(() => createDefaultWebsiteBlocks({ practiceName: "Minimal" })).not.toThrow();
  });

  it("contactCard contains address when provided", () => {
    const blocks = createDefaultWebsiteBlocks({
      practiceName: "Test",
      address: "Musterstraße 1",
      city: "Berlin",
    });
    const card = blocks.find((b) => b.type === "contactCard");
    const props = card?.props as { address?: string };
    expect(props?.address).toContain("Musterstraße 1");
  });
});
