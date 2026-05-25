// @vitest-environment node
// Note: subscriptions router uses the global appDb (not ctx.db) for all queries,
// so only permission-guard tests are feasible without mocking the Stripe client and appDb.
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { createTestDb, createTestCaller, seedTestTenant, type TestDb } from "@/server/__tests__/helpers";
import { PERMISSIONS } from "@/lib/db/schema";

vi.mock("@/lib/email/service");
vi.mock("@/lib/events/appointment");
vi.mock("@/server/audit");
vi.mock("@/lib/stripe/client");

let db: TestDb;
let cleanup: () => Promise<void>;
let tenantId: string;
let clerkId: string;

beforeAll(async () => {
  ({ db, cleanup } = await createTestDb());
  const { tenant, user } = await seedTestTenant(db);
  tenantId = tenant.id;
  clerkId = user.clerkId;
}, 60_000);

afterAll(async () => {
  await cleanup?.();
});

describe("subscriptions — SETTINGS_MANAGE permission guards", () => {
  it("createCheckoutSession requires SETTINGS_MANAGE", async () => {
    const caller = createTestCaller(db, { clerkId, permissions: [] });
    await expect(
      caller.subscriptions.createCheckoutSession({ tier: "solo", billingInterval: "monthly" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("changePlan requires SETTINGS_MANAGE", async () => {
    const caller = createTestCaller(db, { clerkId, permissions: [] });
    await expect(
      caller.subscriptions.changePlan({ tier: "praxis", billingInterval: "monthly" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("cancelSubscription requires SETTINGS_MANAGE", async () => {
    const caller = createTestCaller(db, { clerkId, permissions: [] });
    await expect(
      caller.subscriptions.cancelSubscription()
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("undoCancellation requires SETTINGS_MANAGE", async () => {
    const caller = createTestCaller(db, { clerkId, permissions: [] });
    await expect(
      caller.subscriptions.undoCancellation()
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
