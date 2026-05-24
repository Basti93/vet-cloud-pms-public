import { describe, it, expect } from "vitest";
import { createDefaultWebsiteBlocks } from "@/lib/website-platform/default-blocks";
import { normalizeWeekSchedule, openingHoursToDisplayRows } from "@/lib/schedule-types";
import type { DaySchedule } from "@/lib/schedule-types";

// Cross-functional: DaySchedule[] → normalizeWeekSchedule → openingHoursToDisplayRows → createDefaultWebsiteBlocks

const monToFriOpen: DaySchedule[] = [
  { dayOfWeek: 0, slots: [] },
  { dayOfWeek: 1, slots: [{ startHour: 9, startMin: 0, endHour: 17, endMin: 0 }] },
  { dayOfWeek: 2, slots: [{ startHour: 9, startMin: 0, endHour: 17, endMin: 0 }] },
  { dayOfWeek: 3, slots: [{ startHour: 9, startMin: 0, endHour: 17, endMin: 0 }] },
  { dayOfWeek: 4, slots: [{ startHour: 9, startMin: 0, endHour: 17, endMin: 0 }] },
  { dayOfWeek: 5, slots: [{ startHour: 9, startMin: 0, endHour: 17, endMin: 0 }] },
  { dayOfWeek: 6, slots: [] },
];

describe("schedule → display rows chain", () => {
  it("normalizeWeekSchedule → openingHoursToDisplayRows groups Mo–Fr into one row", () => {
    const normalized = normalizeWeekSchedule(monToFriOpen);
    const rows = openingHoursToDisplayRows(normalized);
    const workdayRow = rows.find((r) => r.time === "09:00–17:00");
    expect(workdayRow).toBeDefined();
    expect(workdayRow?.day).toBe("Mo–Fr");
  });

  it("closed days appear as Geschlossen in display rows", () => {
    const normalized = normalizeWeekSchedule(monToFriOpen);
    const rows = openingHoursToDisplayRows(normalized);
    expect(rows.some((r) => r.time === "Geschlossen")).toBe(true);
  });
});

describe("schedule → website blocks chain", () => {
  it("hours table block sections reflect the schedule display rows", () => {
    const blocks = createDefaultWebsiteBlocks({
      practiceName: "Ketten-Test-Praxis",
      consultationHours: monToFriOpen,
    });

    const hoursBlock = blocks.find((b) => b.type === "hoursTable");
    expect(hoursBlock).toBeDefined();

    const props = hoursBlock?.props as {
      sections: Array<{ rows: Array<{ days: string; time: string }> }>;
    };

    // All rows come from normalizeWeekSchedule + openingHoursToDisplayRows
    const expected = openingHoursToDisplayRows(normalizeWeekSchedule(monToFriOpen));
    const actualRows = props.sections.flatMap((s) => s.rows);

    for (const expectedRow of expected) {
      const match = actualRows.find(
        (r) => r.days === expectedRow.day && r.time === expectedRow.time
      );
      expect(match).toBeDefined();
    }
  });

  it("null consultationHours produces hours block without crashing", () => {
    expect(() =>
      createDefaultWebsiteBlocks({ practiceName: "Test", consultationHours: null })
    ).not.toThrow();
    const blocks = createDefaultWebsiteBlocks({ practiceName: "Test", consultationHours: null });
    expect(blocks.some((b) => b.type === "hoursTable")).toBe(true);
  });
});
