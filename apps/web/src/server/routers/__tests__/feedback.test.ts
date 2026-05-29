// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { eq } from "drizzle-orm";
import { createTestDb, createTestCaller, seedTestTenant, type TestDb } from "@/server/__tests__/helpers";
import { userFeedback } from "@/lib/db/schema";

vi.mock("@/server/trpc/logging-middleware", () => ({
  logEventAsync: vi.fn(),
  logEvent: vi.fn(async () => undefined),
  serializeLogError: (err: unknown) => ({ errorMessage: String(err) }),
  loggingMiddleware: ({ next }: { next: () => Promise<unknown> }) => next(),
}));
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
let adminDb: TestDb;
let cleanup: () => Promise<void>;
let tenantId: string;
let userId: string;
let clerkId: string;

beforeAll(async () => {
  ({ db, adminDb, cleanup } = await createTestDb());
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
    const caller = createTestCaller(db, { clerkId, adminDb });

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
  });

  it("rejects empty feedback", async () => {
    const caller = createTestCaller(db, { clerkId, adminDb });

    await expect(
      caller.feedback.submit({
        message: "   ",
        category: "bug",
        sourcePath: "/dashboard",
        sourceModule: "dashboard",
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("rejects requests with a spoofed tenantId", async () => {
    const caller = createTestCaller(db, { clerkId, adminDb });

    // enforceTenantOwnership reads getRawInput() before Zod strips unknown fields.
    // Any tenantId that doesn't match the authenticated tenant is blocked outright.
    await expect(
      caller.feedback.submit({
        message: "Bitte kompaktere Vitalzeichenansicht.",
        category: "idea",
        sourcePath: "/dashboard/patients/patient-1",
        sourceModule: "medical-records",
        tenantId: "00000000-0000-4000-8000-000000000999",
      } as any)
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
