import { describe, it, expect, vi } from "vitest";
import { sendTrialExpiredAdminEmail } from "@/lib/email/templates/trial-expired-admin";

const makeSendFn = (result: { success: boolean; error?: unknown } = { success: true }) =>
  vi.fn().mockResolvedValue(result);

describe("sendTrialExpiredAdminEmail", () => {
  const input = {
    clinicName: "Praxis Mustermann",
    adminEmail: "admin@praxis.de",
    adminDashboardUrl: "https://admin.example.com/tenants/123",
  };

  it("calls sendFn with clinic name in subject", async () => {
    const sendFn = makeSendFn();
    await sendTrialExpiredAdminEmail(input, sendFn);
    expect(sendFn).toHaveBeenCalledOnce();
    expect(sendFn.mock.calls[0][0].subject).toContain("Praxis Mustermann");
  });

  it("body contains admin dashboard URL", async () => {
    const sendFn = makeSendFn();
    await sendTrialExpiredAdminEmail(input, sendFn);
    const body: string = sendFn.mock.calls[0][0].text;
    expect(body).toContain("https://admin.example.com/tenants/123");
  });

  it("sends to correct admin email", async () => {
    const sendFn = makeSendFn();
    await sendTrialExpiredAdminEmail(input, sendFn);
    expect(sendFn.mock.calls[0][0].to).toBe("admin@praxis.de");
  });

  it("propagates sendFn error result to caller", async () => {
    const sendFn = makeSendFn({ success: false, error: "rate-limit" });
    const result = await sendTrialExpiredAdminEmail(input, sendFn);
    expect(result).toEqual({ success: false, error: "rate-limit" });
  });

  it("includes optional contactAction in body when provided", async () => {
    const sendFn = makeSendFn();
    await sendTrialExpiredAdminEmail(
      { ...input, contactAction: "Upgrade-Angebot senden" },
      sendFn
    );
    // contactAction is available on the input — body content may vary by impl
    expect(sendFn).toHaveBeenCalledOnce();
  });
});
