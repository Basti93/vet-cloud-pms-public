/**
 * Template builder tests — pure assertions on subject/text content.
 * No network, no real DB. vi.mock hoisting ensures systemProvider is mocked
 * before service.ts captures it at module init.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createInMemoryProvider, type SentEmail } from "./helpers/in-memory-provider";

const inMemory = createInMemoryProvider();

vi.mock("../providers", () => ({
  getEmailProvider: () => inMemory.provider,
  getProviderForTenant: vi.fn().mockResolvedValue({ provider: inMemory.provider, from: null }),
}));

vi.mock("@/lib/db/client", () => ({
  db: { insert: vi.fn(() => ({ values: vi.fn().mockResolvedValue(undefined) })) },
  adminDb: { insert: vi.fn(() => ({ values: vi.fn().mockResolvedValue(undefined) })) },
}));

// Import after mocks are established
const {
  sendConfirmationEmail,
  sendReminderEmail,
  sendBookingRequestEmail,
  sendBookingNotificationEmail,
  sendAccountDeletionEmail,
  sendTenantDeactivationEmail,
  sendTenantLifecycleEmail,
  sendUserInvitationEmail,
  sendVaccinationReminderEmail,
} = await import("../service");

function last(): SentEmail {
  return inMemory.sent[inMemory.sent.length - 1];
}

beforeEach(() => inMemory.reset());

describe("confirmation email", () => {
  it("subject contains practice name", async () => {
    await sendConfirmationEmail({
      to: "owner@test.de", practiceName: "Musterklinik",
      ownerFirstName: "Hans", patientName: "Bello", patientSpecies: "Hund",
      appointmentDate: "01.01.2025", appointmentTime: "10:00", appointmentDateTime: "01.01.2025 10:00",
    });
    expect(last().subject).toContain("Musterklinik");
  });

  it("text contains patient name and species", async () => {
    await sendConfirmationEmail({
      to: "owner@test.de", practiceName: "Klinik",
      ownerFirstName: "Maria", patientName: "Mimi", patientSpecies: "Katze",
      appointmentDate: "15.03.2025", appointmentTime: "14:00", appointmentDateTime: "15.03.2025 14:00",
    });
    expect(last().text).toContain("Mimi");
    expect(last().text).toContain("Katze");
  });
});

describe("reminder email", () => {
  it("uses default subject when no custom subject provided", async () => {
    await sendReminderEmail({
      to: "owner@test.de", practiceName: "Klinik",
      ownerFirstName: "Hans", patientName: "Rex", patientSpecies: "Hund",
      appointmentDate: "20.03.2025", appointmentTime: "09:00", appointmentDateTime: "20.03.2025 09:00",
    });
    expect(last().subject).toBeTruthy();
  });

  it("uses custom subject and body when provided", async () => {
    await sendReminderEmail({
      to: "owner@test.de", practiceName: "Klinik",
      ownerFirstName: "Hans", patientName: "Rex", patientSpecies: "Hund",
      appointmentDate: "20.03.2025", appointmentTime: "09:00", appointmentDateTime: "20.03.2025 09:00",
      customSubject: "Individuell Betreff",
      customBody: "Individuell Inhalt.",
    });
    expect(last().subject).toBe("Individuell Betreff");
    expect(last().text).toBe("Individuell Inhalt.");
  });
});

describe("booking request email", () => {
  it("includes confirm and cancel URLs", async () => {
    await sendBookingRequestEmail({
      to: "owner@test.de", practiceName: "Klinik",
      ownerFirstName: "Hans", patientName: "Rex", patientSpecies: "Hund",
      appointmentDate: "20.03.2025", appointmentTime: "09:00", appointmentDateTime: "20.03.2025 09:00",
      confirmUrl: "https://example.com/confirm?t=abc",
      cancelUrl: "https://example.com/cancel?t=abc",
    });
    expect(last().text).toContain("https://example.com/confirm?t=abc");
    expect(last().text).toContain("https://example.com/cancel?t=abc");
  });

  it("subject contains practice name", async () => {
    await sendBookingRequestEmail({
      to: "owner@test.de", practiceName: "Musterklinik",
      ownerFirstName: "Hans", patientName: "Rex", patientSpecies: "Hund",
      appointmentDate: "20.03.2025", appointmentTime: "09:00", appointmentDateTime: "20.03.2025 09:00",
      confirmUrl: "https://example.com/c", cancelUrl: "https://example.com/x",
    });
    expect(last().subject).toContain("Musterklinik");
  });
});

describe("booking notification email", () => {
  it("is sent (system provider)", async () => {
    const result = await sendBookingNotificationEmail({
      to: "staff@klinik.de", practiceName: "Klinik",
      ownerFirstName: "Hans", ownerLastName: "Müller",
      patientName: "Rex", patientSpecies: "Hund",
      appointmentDate: "20.03.2025", appointmentDateTime: "20.03.2025 09:00",
    });
    expect(result.success).toBe(true);
    expect(inMemory.sent).toHaveLength(1);
  });
});

describe("account deletion email", () => {
  it("subject indicates deletion", async () => {
    await sendAccountDeletionEmail({
      to: "admin@test.de",
      confirmUrl: "https://example.com/confirm-delete",
      expiresAt: "01.04.2025",
    });
    expect(last().subject).toContain("Kontolöschung");
  });

  it("text includes confirm URL and warning", async () => {
    await sendAccountDeletionEmail({
      to: "admin@test.de",
      confirmUrl: "https://example.com/confirm-delete",
      expiresAt: "01.04.2025",
    });
    expect(last().text).toContain("https://example.com/confirm-delete");
    expect(last().text).toContain("WARNUNG");
  });
});

describe("tenant deactivation email", () => {
  it("includes scheduled date and reactivate URL", async () => {
    await sendTenantDeactivationEmail({
      to: "admin@test.de", practiceName: "Klinik",
      scheduledFor: "30.06.2025", reactivateUrl: "https://example.com/reactivate",
    });
    expect(last().text).toContain("30.06.2025");
    expect(last().text).toContain("https://example.com/reactivate");
  });
});

describe("tenant lifecycle email", () => {
  it("passes through subject and body unchanged", async () => {
    await sendTenantLifecycleEmail({
      to: "admin@test.de", practiceName: "Klinik",
      subject: "Spezifischer Betreff", body: "Spezifischer Inhalt.",
    });
    expect(last().subject).toBe("Spezifischer Betreff");
    expect(last().text).toBe("Spezifischer Inhalt.");
  });
});

describe("user invitation email", () => {
  it("subject contains practice name", async () => {
    await sendUserInvitationEmail({
      to: "vet@test.de", practiceName: "Musterklinik",
      role: "vet", acceptUrl: "https://example.com/accept", expiresAt: "01.04.2025",
    });
    expect(last().subject).toContain("Musterklinik");
  });

  it("text contains accept URL and expiry", async () => {
    await sendUserInvitationEmail({
      to: "vet@test.de", practiceName: "Klinik",
      role: "admin", acceptUrl: "https://example.com/accept?t=abc", expiresAt: "15.04.2025",
    });
    expect(last().text).toContain("https://example.com/accept?t=abc");
    expect(last().text).toContain("15.04.2025");
  });
});

describe("vaccination reminder email", () => {
  it("substitutes all placeholders in subject and body", async () => {
    await sendVaccinationReminderEmail({
      tenantId: "t1", vaccinationId: "v1",
      ownerEmail: "owner@test.de", ownerName: "Hans",
      petName: "Bello", vaccinationType: "Tollwut",
      dueDate: new Date("2025-04-01"), clinicName: "Klinik",
      customSubject: "Erinnerung für {petName}",
      customBody: "Hallo {ownerName}, {petName} braucht {vaccinationType}.",
    });
    expect(last().subject).toBe("Erinnerung für Bello");
    expect(last().text).toContain("Hallo Hans");
    expect(last().text).toContain("Tollwut");
  });

  it("appends booking URL when not in body template", async () => {
    await sendVaccinationReminderEmail({
      tenantId: "t1", vaccinationId: "v1",
      ownerEmail: "owner@test.de", ownerName: "Hans",
      petName: "Bello", vaccinationType: "Tollwut",
      dueDate: new Date("2025-04-01"), clinicName: "Klinik",
      bookingUrl: "https://example.com/book",
      customSubject: "Erinnerung", customBody: "Bitte kommen Sie vorbei.",
    });
    expect(last().text).toContain("https://example.com/book");
  });
});

