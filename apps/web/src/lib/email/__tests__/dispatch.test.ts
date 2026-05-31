import { describe, it, expect, vi, beforeEach } from "vitest";
import { dispatch, type TemplateResult } from "../service";
import { createInMemoryProvider } from "./helpers/in-memory-provider";

vi.mock("../providers", () => ({
  getEmailProvider: () => ({ name: "mock-system", send: vi.fn().mockResolvedValue({ messageId: "sys-mock" }) }),
  getProviderForTenant: vi.fn().mockResolvedValue({
    provider: { name: "mock-tenant", send: vi.fn().mockResolvedValue({ messageId: "tenant-mock" }) },
    from: null,
  }),
}));

vi.mock("@/lib/db/client", () => ({
  db: { insert: vi.fn(() => ({ values: vi.fn().mockResolvedValue(undefined) })) },
  adminDb: { insert: vi.fn(() => ({ values: vi.fn().mockResolvedValue(undefined) })) },
}));

const baseTemplate: TemplateResult = {
  to: "owner@example.com",
  subject: "Test Subject",
  text: "Test body",
  emailType: "confirmation",
  providerKind: "system",
};

describe("dispatch", () => {
  let inMemory: ReturnType<typeof createInMemoryProvider>;

  beforeEach(() => {
    inMemory = createInMemoryProvider();
  });

  it("calls provider.send with subject and text from the template", async () => {
    await dispatch(() => baseTemplate, inMemory.provider);
    expect(inMemory.sent).toHaveLength(1);
    expect(inMemory.sent[0].subject).toBe("Test Subject");
    expect(inMemory.sent[0].text).toBe("Test body");
  });

  it("returns { success: true, messageId } on success", async () => {
    const result = await dispatch(() => baseTemplate, inMemory.provider);
    expect(result.success).toBe(true);
    expect(result.messageId).toBe("test-1");
  });

  it("returns { success: false, error } when provider.send throws", async () => {
    const failing = createInMemoryProvider({ failOnSend: true });
    const result = await dispatch(() => baseTemplate, failing.provider);
    expect(result.success).toBe(false);
    expect(result.error).toBeInstanceOf(Error);
  });

  it("does not throw even when provider.send throws", async () => {
    const failing = createInMemoryProvider({ failOnSend: true });
    await expect(dispatch(() => baseTemplate, failing.provider)).resolves.not.toThrow();
  });

  it("uses the injected provider, not system SMTP", async () => {
    await dispatch(() => baseTemplate, inMemory.provider);
    expect(inMemory.sent).toHaveLength(1);
  });

  it("sends to the correct recipient", async () => {
    await dispatch(() => ({ ...baseTemplate, to: "vet@clinic.de" }), inMemory.provider);
    expect(inMemory.sent[0].to).toBe("vet@clinic.de");
  });

  it("returns { success: false } when builder throws before send", async () => {
    const result = await dispatch(() => {
      throw new Error("builder error");
    }, inMemory.provider);
    expect(result.success).toBe(false);
    expect(inMemory.sent).toHaveLength(0);
  });

  it("forwards html to provider when present", async () => {
    await dispatch(
      () => ({ ...baseTemplate, html: "<p>hello</p>" }),
      inMemory.provider
    );
    expect(inMemory.sent[0].html).toBe("<p>hello</p>");
  });
});
