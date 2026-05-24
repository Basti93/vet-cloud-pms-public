import { describe, it, expect, vi } from "vitest";
import { sendPaymentFailedAdminEmail } from "@/lib/email/templates/payment-failed";

const makeSendFn = (result: { success: boolean; error?: unknown } = { success: true }) =>
  vi.fn().mockResolvedValue(result);

describe("sendPaymentFailedAdminEmail", () => {
  const input = {
    clinicName: "Tierklinik Muster",
    adminEmails: ["admin@muster.de", "secondary@muster.de"],
    gracePeriodEndsAt: new Date("2026-07-01T00:00:00Z"),
    paymentMethodUpdateUrl: "https://billing.stripe.com/session/abc",
  };

  it("calls sendFn with clinic name in subject", async () => {
    const sendFn = makeSendFn();
    await sendPaymentFailedAdminEmail(input, sendFn);
    expect(sendFn).toHaveBeenCalledOnce();
    const [call] = sendFn.mock.calls;
    expect(call[0].subject).toContain("Tierklinik Muster");
  });

  it("body contains grace period date in de-DE format", async () => {
    const sendFn = makeSendFn();
    await sendPaymentFailedAdminEmail(input, sendFn);
    const body: string = sendFn.mock.calls[0][0].text;
    // de-DE date format: "1.7.2026" or "01.07.2026"
    expect(body).toMatch(/2026/);
    expect(body).toContain("Grace Period");
  });

  it("body contains paymentMethodUpdateUrl", async () => {
    const sendFn = makeSendFn();
    await sendPaymentFailedAdminEmail(input, sendFn);
    const body: string = sendFn.mock.calls[0][0].text;
    expect(body).toContain("https://billing.stripe.com/session/abc");
  });

  it("sends to first admin email address", async () => {
    const sendFn = makeSendFn();
    await sendPaymentFailedAdminEmail(input, sendFn);
    expect(sendFn.mock.calls[0][0].to).toBe("admin@muster.de");
  });

  it("propagates sendFn return value to caller", async () => {
    const sendFn = makeSendFn({ success: false, error: "network-timeout" });
    const result = await sendPaymentFailedAdminEmail(input, sendFn);
    expect(result).toEqual({ success: false, error: "network-timeout" });
  });

  it("sends to empty string when adminEmails is empty", async () => {
    const sendFn = makeSendFn();
    await sendPaymentFailedAdminEmail({ ...input, adminEmails: [] }, sendFn);
    expect(sendFn.mock.calls[0][0].to).toBe("");
  });
});
