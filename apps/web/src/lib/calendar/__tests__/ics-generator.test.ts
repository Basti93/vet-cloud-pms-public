import { describe, it, expect, afterEach, vi } from "vitest";
import {
  generateAppointmentICS,
  validateICalFormat,
  getTZID,
} from "@/lib/calendar/ics-generator";
import type { ICalEventData } from "@/lib/calendar/ics-generator";

afterEach(() => {
  vi.unstubAllEnvs();
});

const makeEvent = (overrides: Partial<ICalEventData> = {}): ICalEventData => ({
  appointment: {
    id: "appt-1",
    title: "Impfung",
    status: "scheduled",
    startTime: new Date("2026-06-01T09:00:00Z"),
    endTime: new Date("2026-06-01T09:30:00Z"),
    createdAt: new Date("2026-05-01T08:00:00Z"),
    updatedAt: new Date("2026-05-01T08:00:00Z"),
  },
  patient: {
    name: "Bello",
    species: "Hund",
    breed: "Labrador",
    owner: {
      firstName: "Max",
      lastName: "Muster",
      phone: "+49123456789",
      email: "max@example.de",
    },
  },
  veterinarian: {
    title: "Dr.",
    firstName: "Anna",
    lastName: "Schmidt",
  },
  clinicName: "Tierarztpraxis Muster",
  clinicAddress: "Musterstr. 1",
  clinicCity: "Berlin",
  practiceTimezone: "Europe/Berlin",
  ...overrides,
});

describe("validateICalFormat", () => {
  it("returns true for valid VCALENDAR content", () => {
    const ics = "BEGIN:VCALENDAR\r\nEND:VCALENDAR";
    expect(validateICalFormat(ics)).toBe(true);
  });

  it("returns false when BEGIN:VCALENDAR is missing", () => {
    expect(validateICalFormat("END:VCALENDAR")).toBe(false);
  });

  it("returns false when END:VCALENDAR is missing", () => {
    expect(validateICalFormat("BEGIN:VCALENDAR")).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(validateICalFormat("")).toBe(false);
  });
});

describe("getTZID", () => {
  it("returns the IANA timezone string unchanged", () => {
    expect(getTZID("Europe/Berlin")).toBe("Europe/Berlin");
    expect(getTZID("America/New_York")).toBe("America/New_York");
  });
});

describe("generateAppointmentICS", () => {
  it("produces valid VCALENDAR structure", () => {
    vi.stubEnv("NEXT_PUBLIC_SYSTEM_NAME", "test.example.com");
    const ics = generateAppointmentICS([makeEvent()], "clinic@example.de", "example.de", "Test Clinic");
    expect(validateICalFormat(ics)).toBe(true);
  });

  it("contains required iCal headers", () => {
    vi.stubEnv("NEXT_PUBLIC_SYSTEM_NAME", "test.example.com");
    const ics = generateAppointmentICS([makeEvent()], "clinic@example.de", "example.de", "Test Clinic");
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("VERSION:2.0");
    expect(ics).toContain("BEGIN:VEVENT");
    expect(ics).toContain("END:VEVENT");
    expect(ics).toContain("END:VCALENDAR");
  });

  it("maps scheduled status to CONFIRMED", () => {
    vi.stubEnv("NEXT_PUBLIC_SYSTEM_NAME", "test.example.com");
    const ics = generateAppointmentICS([makeEvent()], "clinic@example.de", "example.de", "Test Clinic");
    expect(ics).toContain("STATUS:CONFIRMED");
  });

  it("maps cancelled status to CANCELLED", () => {
    vi.stubEnv("NEXT_PUBLIC_SYSTEM_NAME", "test.example.com");
    const event = makeEvent({ appointment: { ...makeEvent().appointment, status: "cancelled" } });
    const ics = generateAppointmentICS([event], "clinic@example.de", "example.de", "Test Clinic");
    expect(ics).toContain("STATUS:CANCELLED");
  });

  it("maps unknown status to TENTATIVE", () => {
    vi.stubEnv("NEXT_PUBLIC_SYSTEM_NAME", "test.example.com");
    const event = makeEvent({ appointment: { ...makeEvent().appointment, status: "pending" } });
    const ics = generateAppointmentICS([event], "clinic@example.de", "example.de", "Test Clinic");
    expect(ics).toContain("STATUS:TENTATIVE");
  });

  it("handles missing optional fields (breed, address) without throwing", () => {
    vi.stubEnv("NEXT_PUBLIC_SYSTEM_NAME", "test.example.com");
    const event = makeEvent({
      patient: { name: "Bello", species: "Hund", owner: { firstName: "Max", lastName: "Muster" } },
      clinicAddress: undefined,
      clinicCity: undefined,
    });
    expect(() =>
      generateAppointmentICS([event], "clinic@example.de", "example.de", "Test Clinic")
    ).not.toThrow();
  });

  it("returns valid calendar with zero events", () => {
    vi.stubEnv("NEXT_PUBLIC_SYSTEM_NAME", "test.example.com");
    const ics = generateAppointmentICS([], "clinic@example.de", "example.de", "Test Clinic");
    expect(validateICalFormat(ics)).toBe(true);
    expect(ics).not.toContain("BEGIN:VEVENT");
  });
});
