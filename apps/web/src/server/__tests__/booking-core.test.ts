import { describe, expect, it, vi, afterEach } from "vitest";
import {
  filterAvailableSlots,
  generateSlotsFromRanges,
  intervalsOverlap,
  selectVetByFairDistribution,
  zonedToUtc,
} from "@/server/booking-core";

describe("booking core slot generation", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("converts Europe/Berlin local appointment times to UTC", () => {
    expect(zonedToUtc("2026-01-15", 9, 30, "Europe/Berlin").toISOString()).toBe(
      "2026-01-15T08:30:00.000Z"
    );
    expect(zonedToUtc("2026-07-15", 9, 30, "Europe/Berlin").toISOString()).toBe(
      "2026-07-15T07:30:00.000Z"
    );
  });

  it("generates only future slots across consultation ranges", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-15T08:15:00.000Z"));

    const slots = generateSlotsFromRanges(
      "2026-01-15",
      [
        { startHour: 9, startMin: 0, endHour: 10, endMin: 0 },
        { startHour: 16, startMin: 0, endHour: 17, endMin: 0 },
      ],
      "Europe/Berlin",
      30
    );

    expect(slots.map((slot) => slot.start.toISOString())).toEqual([
      "2026-01-15T08:30:00.000Z",
      "2026-01-15T15:00:00.000Z",
      "2026-01-15T15:30:00.000Z",
    ]);
  });

  it("respects vet-specific slot duration", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-14T12:00:00.000Z"));

    const slots = generateSlotsFromRanges(
      "2026-01-15",
      [{ startHour: 9, startMin: 0, endHour: 10, endMin: 0 }],
      "Europe/Berlin",
      20
    );

    expect(slots).toHaveLength(3);
    expect(slots.map((slot) => [slot.start.toISOString(), slot.end.toISOString()])).toEqual([
      ["2026-01-15T08:00:00.000Z", "2026-01-15T08:20:00.000Z"],
      ["2026-01-15T08:20:00.000Z", "2026-01-15T08:40:00.000Z"],
      ["2026-01-15T08:40:00.000Z", "2026-01-15T09:00:00.000Z"],
    ]);
  });

  it("returns no slots for an empty schedule such as a vet absence day", () => {
    const slots = generateSlotsFromRanges("2026-01-15", [], "Europe/Berlin", 30);
    expect(slots).toEqual([]);
  });
});

describe("booking core availability decisions", () => {
  const slot = {
    start: new Date("2026-01-15T09:00:00.000Z"),
    end: new Date("2026-01-15T09:30:00.000Z"),
  };

  it("detects overlapping bookings but allows adjacent bookings", () => {
    expect(
      intervalsOverlap(slot, {
        startTime: "2026-01-15T09:15:00.000Z",
        endTime: "2026-01-15T09:45:00.000Z",
      })
    ).toBe(true);

    expect(
      intervalsOverlap(slot, {
        startTime: "2026-01-15T09:30:00.000Z",
        endTime: "2026-01-15T10:00:00.000Z",
      })
    ).toBe(false);
  });

  it("excludes booked and actively held slots", () => {
    const slots = [
      slot,
      {
        start: new Date("2026-01-15T09:30:00.000Z"),
        end: new Date("2026-01-15T10:00:00.000Z"),
      },
      {
        start: new Date("2026-01-15T10:00:00.000Z"),
        end: new Date("2026-01-15T10:30:00.000Z"),
      },
    ];

    const available = filterAvailableSlots(
      slots,
      [{ startTime: "2026-01-15T09:10:00.000Z", endTime: "2026-01-15T09:25:00.000Z" }],
      [{ slotDatetime: "2026-01-15T09:30:00.000Z" }]
    );

    expect(available).toEqual([slots[2]]);
  });

  it("selects the vet with the fewest scheduled appointments without mutating input", () => {
    const vets = [
      { id: "busy", appointmentCount: 3 },
      { id: "free", appointmentCount: 0 },
      { id: "medium", appointmentCount: 1 },
    ];

    expect(selectVetByFairDistribution(vets)).toBe("free");
    expect(vets.map((vet) => vet.id)).toEqual(["busy", "free", "medium"]);
  });

  it("throws when no vet is available for auto-assignment", () => {
    expect(() => selectVetByFairDistribution([])).toThrow("No vets available");
  });
});
