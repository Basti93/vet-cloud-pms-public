// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { eq } from "drizzle-orm";
import { createTestDb, createTestCaller, seedTestTenant, type TestDb } from "@/server/__tests__/helpers";
import { userFeedback } from "@/lib/db/schema";

vi.mock("@clerk/nextjs/server", () => ({
  clerkClient: vi.fn(async () => ({
    users: {
      getUser: vi.fn(async () => ({
        emailAddresses: [{ emailAddress: "admin@example.test" }],
      })),
    },
  })),
}));
vi.mock("@/lib/email/service", () => ({
  sendTenantLifecycleEmail: vi.fn(async () => ({ success: true, messageId: "msg_1" })),
}));
vi.mock("@/lib/events/appointment");
vi.mock("@/server/audit", () => ({
  writeAuditLog: vi.fn(async () => undefined),
}));

let db: TestDb;
let cleanup: () => Promise<void>;
let tenantId: string;
let userId: string;
let clerkId: string;

beforeAll(async () => {
  ({ db, cleanup } = await createTestDb());
  const { tenant, user } = await seedTestTenant(db);
  tenantId = tenant.id;
  userId = user.id;
  clerkId = user.clerkId;
}, 60_000);

afterAll(async () => {
  await cleanup?.();
}, 30_000);

describe("feedback.submit", () => {
  it("stores feedback with tenant and user context", async () => {
    const caller = createTestCaller(db, { clerkId });

    const result = await caller.feedback.submit({
      message: "Diagnosen brauchen ein Feld fuer Verlauf.",
      category: "idea",
      sourcePath: "/dashboard/patients/patient-1",
      sourceModule: "medical-records",
      browserMetadata: {
        viewport: { width: 1280, height: 720 },
        language: "de-DE",
      },
    });

    expect(result?.id).toBeDefined();

    const [stored] = await db
      .select()
      .from(userFeedback)
      .where(eq(userFeedback.id, result.id))
      .limit(1);

    expect(stored.tenantId).toBe(tenantId);
    expect(stored.userId).toBe(userId);
    expect(stored.status).toBe("new");
    expect(stored.category).toBe("idea");
    expect(stored.sourceModule).toBe("medical-records");
  }, 30_000);

  it("rejects empty feedback", async () => {
    const caller = createTestCaller(db, { clerkId });

    await expect(
      caller.feedback.submit({
        message: "   ",
        category: "bug",
        sourcePath: "/dashboard",
        sourceModule: "dashboard",
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  }, 30_000);

  it("ignores spoofed tenant and user payload fields", async () => {
    const caller = createTestCaller(db, { clerkId });

    const result = await caller.feedback.submit({
      message: "Bitte kompaktere Vitalzeichenansicht.",
      category: "idea",
      sourcePath: "/dashboard/patients/patient-1",
      sourceModule: "medical-records",
      tenantId: "00000000-0000-4000-8000-000000000999",
      userId: "00000000-0000-4000-8000-000000000998",
    } as any);

    const [stored] = await db
      .select()
      .from(userFeedback)
      .where(eq(userFeedback.id, result.id))
      .limit(1);

    expect(stored.tenantId).toBe(tenantId);
    expect(stored.userId).toBe(userId);
  }, 30_000);
});
