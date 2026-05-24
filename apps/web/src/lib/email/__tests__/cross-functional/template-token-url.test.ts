import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { generateConfirmationToken, verifyConfirmationToken, buildConfirmationUrl } from "@/lib/tokens/confirmation";
import { replacePlaceholders } from "@/lib/email/templates";
import type { EmailPlaceholders } from "@/lib/email/templates";

// Cross-functional: generateConfirmationToken → buildConfirmationUrl → replacePlaceholders → verify round-trip

const SECRET = "test-secret-with-at-least-thirty-two-characters";

beforeEach(() => {
  process.env.JWT_SECRET = SECRET;
});

afterEach(() => {
  delete process.env.JWT_SECRET;
});

describe("email template → token → URL chain", () => {
  const placeholders: EmailPlaceholders = {
    practiceName: "Tierarztpraxis Kette",
    ownerFirstName: "Anna",
    patientName: "Mimi",
    patientSpecies: "Katze",
    appointmentDate: "20. Juli 2026",
    appointmentTime: "10:00",
    appointmentDateTime: "20. Juli 2026 um 10:00 Uhr",
  };

  it("confirm URL embedded in template body is round-trip verifiable", () => {
    const token = generateConfirmationToken("appt-42", "anna@example.de", "confirm");
    const confirmUrl = buildConfirmationUrl(token, "https://app.example.com", "confirm");

    const body = replacePlaceholders(
      "Bitte bestätigen Sie: {confirmUrl}",
      { ...placeholders, confirmUrl }
    );

    expect(body).toContain("https://app.example.com/confirm?token=");

    // Extract token back from URL and verify it round-trips
    const embeddedToken = new URL(body.split("bestätigen Sie: ")[1]).searchParams.get("token")!;
    const decoded = verifyConfirmationToken(embeddedToken);
    expect(decoded?.appointmentId).toBe("appt-42");
    expect(decoded?.ownerEmail).toBe("anna@example.de");
    expect(decoded?.action).toBe("confirm");
  });

  it("cancel URL embedded in body is distinct from confirm URL", () => {
    const token = generateConfirmationToken("appt-42", "anna@example.de", "cancel");
    const cancelUrl = buildConfirmationUrl(token, "https://app.example.com", "cancel");

    const body = replacePlaceholders(
      "Absagen: {rejectUrl}",
      { ...placeholders, rejectUrl: cancelUrl }
    );

    expect(body).toContain("/api/appointments/cancel");
  });

  it("rendered body with injected confirm URL contains all template placeholders", () => {
    const token = generateConfirmationToken("appt-99", "bob@test.de", "confirm");
    const confirmUrl = buildConfirmationUrl(token, "https://app.example.com", "confirm");

    const template =
      "Hallo {ownerFirstName}, Termin für {patientName} am {appointmentDateTime}. Bestätigen: {confirmUrl}";
    const rendered = replacePlaceholders(template, { ...placeholders, confirmUrl });

    expect(rendered).toContain("Anna");
    expect(rendered).toContain("Mimi");
    expect(rendered).toContain("20. Juli 2026 um 10:00 Uhr");
    expect(rendered).toContain("https://app.example.com/confirm");
  });
});
