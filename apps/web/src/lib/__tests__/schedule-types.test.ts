import { describe, it, expect } from "vitest";
import {
  normalizeWeekSchedule,
  formatTimeRange,
  openingHoursToDisplayRows,
  toFullCalendarBusinessHours,
  type DaySchedule,
  type TimeRange,
} from "@/lib/schedule-types";

const slot = (startHour: number, startMin: number, endHour: number, endMin: number): TimeRange => ({
  startHour, startMin, endHour, endMin,
});

describe("formatTimeRange", () => {
  it("formats a time range as HH:MM–HH:MM", () => {
    expect(formatTimeRange(slot(9, 0, 18, 0))).toBe("09:00–18:00");
    expect(formatTimeRange(slot(8, 30, 17, 30))).toBe("08:30–17:30");
  });

  it("zero-pads single-digit hours and minutes", () => {
    expect(formatTimeRange(slot(8, 0, 9, 0))).toBe("08:00–09:00");
  });
});

describe("normalizeWeekSchedule", () => {
  it("returns 7 days when given a full schedule", () => {
    const input: DaySchedule[] = [0, 1, 2, 3, 4, 5, 6].map((d) => ({
      dayOfWeek: d,
      slots: [],
    }));
    expect(normalizeWeekSchedule(input)).toHaveLength(7);
  });

  it("fills missing days as closed", () => {
    const input: DaySchedule[] = [
      { dayOfWeek: 1, slots: [slot(8, 0, 18, 0)] },
    ];
    const result = normalizeWeekSchedule(input);
    expect(result).toHaveLength(7);
    expect(result.find((d) => d.dayOfWeek === 0)?.slots).toEqual([]);
    expect(result.find((d) => d.dayOfWeek === 1)?.slots).toHaveLength(1);
  });

  it("uses fallback when input is empty", () => {
    const fallback: DaySchedule[] = [{ dayOfWeek: 1, slots: [slot(9, 0, 17, 0)] }];
    const result = normalizeWeekSchedule(null, { fallback });
    expect(result.find((d) => d.dayOfWeek === 1)?.slots).toHaveLength(1);
  });

  it("ignores days outside 0–6", () => {
    const input: DaySchedule[] = [{ dayOfWeek: 7, slots: [slot(8, 0, 18, 0)] }];
    const result = normalizeWeekSchedule(input);
    expect(result).toHaveLength(7);
    result.forEach((d) => expect(d.slots).toEqual([]));
  });

  it("deduplicates when same dayOfWeek appears multiple times", () => {
    const input: DaySchedule[] = [
      { dayOfWeek: 1, slots: [slot(8, 0, 12, 0)] },
      { dayOfWeek: 1, slots: [slot(13, 0, 18, 0)] },
    ];
    const result = normalizeWeekSchedule(input);
    expect(result.filter((d) => d.dayOfWeek === 1)).toHaveLength(1);
    expect(result.find((d) => d.dayOfWeek === 1)?.slots).toHaveLength(1); // first wins
  });
});

describe("openingHoursToDisplayRows", () => {
  it("shows Geschlossen for days with no slots", () => {
    const hours: DaySchedule[] = [0, 1, 2, 3, 4, 5, 6].map((d) => ({ dayOfWeek: d, slots: [] }));
    const rows = openingHoursToDisplayRows(hours);
    expect(rows.every((r) => r.time === "Geschlossen")).toBe(true);
  });

  it("groups consecutive days with same hours", () => {
    const hours: DaySchedule[] = [
      { dayOfWeek: 0, slots: [] },
      { dayOfWeek: 1, slots: [slot(8, 0, 18, 0)] },
      { dayOfWeek: 2, slots: [slot(8, 0, 18, 0)] },
      { dayOfWeek: 3, slots: [slot(8, 0, 18, 0)] },
      { dayOfWeek: 4, slots: [slot(8, 0, 18, 0)] },
      { dayOfWeek: 5, slots: [slot(8, 0, 18, 0)] },
      { dayOfWeek: 6, slots: [] },
    ];
    const rows = openingHoursToDisplayRows(hours);
    const workdayRow = rows.find((r) => r.time === "08:00–18:00");
    expect(workdayRow?.day).toBe("Mo–Fr");
  });

  it("produces individual rows for days with different hours", () => {
    const hours: DaySchedule[] = [
      { dayOfWeek: 0, slots: [] },
      { dayOfWeek: 1, slots: [slot(8, 0, 18, 0)] },
      { dayOfWeek: 2, slots: [slot(9, 0, 17, 0)] },
      { dayOfWeek: 3, slots: [] },
      { dayOfWeek: 4, slots: [] },
      { dayOfWeek: 5, slots: [] },
      { dayOfWeek: 6, slots: [] },
    ];
    const rows = openingHoursToDisplayRows(hours);
    expect(rows.find((r) => r.time === "08:00–18:00")).toBeTruthy();
    expect(rows.find((r) => r.time === "09:00–17:00")).toBeTruthy();
  });
});

describe("toFullCalendarBusinessHours", () => {
  it("returns empty array for all-closed schedule", () => {
    const hours: DaySchedule[] = [0, 1, 2, 3, 4, 5, 6].map((d) => ({ dayOfWeek: d, slots: [] }));
    expect(toFullCalendarBusinessHours(hours)).toEqual([]);
  });

  it("maps open slots to FullCalendar format", () => {
    const hours: DaySchedule[] = [
      { dayOfWeek: 1, slots: [slot(8, 0, 18, 0)] },
      { dayOfWeek: 0, slots: [] },
      { dayOfWeek: 2, slots: [] },
      { dayOfWeek: 3, slots: [] },
      { dayOfWeek: 4, slots: [] },
      { dayOfWeek: 5, slots: [] },
      { dayOfWeek: 6, slots: [] },
    ];
    const result = toFullCalendarBusinessHours(hours);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ daysOfWeek: [1], startTime: "08:00", endTime: "18:00" });
  });

  it("merges days with identical slot times", () => {
    const hours: DaySchedule[] = [
      { dayOfWeek: 1, slots: [slot(9, 0, 17, 0)] },
      { dayOfWeek: 2, slots: [slot(9, 0, 17, 0)] },
      { dayOfWeek: 0, slots: [] },
      { dayOfWeek: 3, slots: [] },
      { dayOfWeek: 4, slots: [] },
      { dayOfWeek: 5, slots: [] },
      { dayOfWeek: 6, slots: [] },
    ];
    const result = toFullCalendarBusinessHours(hours);
    expect(result).toHaveLength(1);
    expect(result[0].daysOfWeek).toContain(1);
    expect(result[0].daysOfWeek).toContain(2);
  });
});
