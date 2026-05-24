import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  buildConfirmationUrl,
  generateConfirmationToken,
  verifyConfirmationToken,
} from "@/lib/tokens/confirmation";

describe("appointment confirmation tokens", () => {
  const originalSecret = process.env.JWT_SECRET;

  beforeEach(() => {
    process.env.JWT_SECRET = "test-secret-with-at-least-thirty-two-characters";
  });

  afterEach(() => {
    process.env.JWT_SECRET = originalSecret;
  });

  it("round-trips appointment id, owner email, and action", () => {
    const token = generateConfirmationToken(
      "11111111-1111-4111-8111-111111111111",
      "owner@example.de",
      "confirm"
    );

    const decoded = verifyConfirmationToken(token);
    expect(decoded).toMatchObject({
      appointmentId: "11111111-1111-4111-8111-111111111111",
      ownerEmail: "owner@example.de",
      action: "confirm",
    });
  });

  it("returns null for malformed tokens", () => {
    expect(verifyConfirmationToken("not-a-jwt")).toBeNull();
  });

  it("builds confirm and cancel URLs", () => {
    expect(buildConfirmationUrl("abc", "https://app.example", "confirm")).toBe(
      "https://app.example/confirm?token=abc"
    );
    expect(buildConfirmationUrl("abc", "https://app.example", "cancel")).toBe(
      "https://app.example/api/appointments/cancel?token=abc"
    );
  });

  it("throws when JWT_SECRET is the placeholder value", () => {
    process.env.JWT_SECRET = "your-secret-key-change-this";
    expect(() =>
      generateConfirmationToken("appt-1", "owner@test.de", "confirm")
    ).toThrow("JWT_SECRET");
  });
});
