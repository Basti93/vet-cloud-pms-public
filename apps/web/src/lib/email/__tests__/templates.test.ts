import { describe, it, expect } from "vitest";
import { emailTemplates, replacePlaceholders } from "@/lib/email/templates";
import type { EmailPlaceholders } from "@/lib/email/templates";

const basePlaceholders: EmailPlaceholders = {
  practiceName: "Tierarztpraxis Muster",
  ownerFirstName: "Max",
  ownerLastName: "Muster",
  patientName: "Bello",
  patientSpecies: "Hund",
  appointmentDate: "15. Juni 2026",
  appointmentTime: "09:30",
  appointmentDateTime: "15. Juni 2026 um 09:30 Uhr",
  vetName: "Dr. Schmidt",
  confirmUrl: "https://app.example.com/confirm?token=abc",
  rejectUrl: "https://app.example.com/cancel?token=abc",
};

describe("replacePlaceholders", () => {
  it("substitutes all provided placeholders", () => {
    const result = replacePlaceholders(
      "Hallo {ownerFirstName}, Termin für {patientName} am {appointmentDateTime}.",
      basePlaceholders
    );
    expect(result).toBe("Hallo Max, Termin für Bello am 15. Juni 2026 um 09:30 Uhr.");
  });

  it("replaces multiple occurrences of the same placeholder", () => {
    const result = replacePlaceholders(
      "{practiceName} begrüßt Sie. Kontakt: {practiceName}.",
      basePlaceholders
    );
    expect(result).toBe("Tierarztpraxis Muster begrüßt Sie. Kontakt: Tierarztpraxis Muster.");
  });

  it("leaves unknown placeholders unchanged when value is undefined", () => {
    const result = replacePlaceholders(
      "Name: {ownerFirstName}, Optional: {vetName}",
      { ...basePlaceholders, vetName: undefined }
    );
    expect(result).toContain("Max");
    expect(result).toContain("{vetName}");
  });

  it("leaves template unchanged when placeholders object has no matching keys", () => {
    const result = replacePlaceholders("{unknownKey}", basePlaceholders);
    expect(result).toBe("{unknownKey}");
  });

  it("handles empty template string", () => {
    expect(replacePlaceholders("", basePlaceholders)).toBe("");
  });
});

describe("emailTemplates.confirmation.render", () => {
  it("renders subject with practiceName substituted", () => {
    const subject = emailTemplates.confirmation.render(
      emailTemplates.confirmation.defaultSubject,
      basePlaceholders
    );
    expect(subject).toBe("Bestätigung: Ihr Termin bei Tierarztpraxis Muster");
  });

  it("renders body with patientName and appointmentDateTime", () => {
    const body = emailTemplates.confirmation.render(
      emailTemplates.confirmation.defaultBody,
      basePlaceholders
    );
    expect(body).toContain("Bello");
    expect(body).toContain("15. Juni 2026 um 09:30 Uhr");
    expect(body).toContain("Tierarztpraxis Muster");
  });
});

describe("emailTemplates.reminder.render", () => {
  it("renders subject with practiceName", () => {
    const subject = emailTemplates.reminder.render(
      emailTemplates.reminder.defaultSubject,
      basePlaceholders
    );
    expect(subject).toBe("Erinnerung: Termin morgen bei Tierarztpraxis Muster");
  });

  it("renders body with patient and time details", () => {
    const body = emailTemplates.reminder.render(
      emailTemplates.reminder.defaultBody,
      basePlaceholders
    );
    expect(body).toContain("Bello");
    expect(body).toContain("09:30");
  });
});

describe("emailTemplates.bookingNotification.render", () => {
  it("renders subject with patientName and date", () => {
    const subject = emailTemplates.bookingNotification.render(
      emailTemplates.bookingNotification.defaultSubject,
      basePlaceholders
    );
    expect(subject).toBe("Neue Terminanfrage: Bello - 15. Juni 2026");
  });

  it("renders body with owner full name and vet", () => {
    const body = emailTemplates.bookingNotification.render(
      emailTemplates.bookingNotification.defaultBody,
      basePlaceholders
    );
    expect(body).toContain("Max");
    expect(body).toContain("Muster");
    expect(body).toContain("Dr. Schmidt");
  });
});
