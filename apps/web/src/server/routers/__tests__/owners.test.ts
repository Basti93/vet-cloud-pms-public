// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { createTestDb, createTestCaller, seedTestTenant, type TestDb } from "@/server/__tests__/helpers";
import { PERMISSIONS, owners, patients } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

vi.mock("@/lib/email/service");
vi.mock("@/lib/events/appointment");
vi.mock("@/server/audit");

let db: TestDb;
let cleanup: () => Promise<void>;
let tenantId: string;
let clerkId: string;

let emailCounter = 0;
function uniqueEmail() {
  return `owner${++emailCounter}@test.de`;
}

beforeAll(async () => {
  ({ db, cleanup } = await createTestDb());
  const { tenant, user } = await seedTestTenant(db);
  tenantId = tenant.id;
  clerkId = user.clerkId;
}, 60_000);

afterAll(async () => {
  await cleanup?.();
});

describe("owners.create", () => {
  it("requires PATIENTS_CREATE permission", async () => {
    const caller = createTestCaller(db, { clerkId, permissions: [] });
    await expect(
      caller.owners.create({ tenantId, firstName: "Max", lastName: "Muster" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("creates owner and returns it", async () => {
    const caller = createTestCaller(db, { clerkId, permissions: [PERMISSIONS.PATIENTS_CREATE] });
    const email = uniqueEmail();
    const result = await caller.owners.create({ tenantId, firstName: "Max", lastName: "Muster", email });
    expect(result.firstName).toBe("Max");
    expect(result.email).toBe(email);
    expect(result.tenantId).toBe(tenantId);
  });

  it("returns existing active owner when same email exists", async () => {
    const caller = createTestCaller(db, { clerkId, permissions: [PERMISSIONS.PATIENTS_CREATE] });
    const email = uniqueEmail();
    const first = await caller.owners.create({ tenantId, firstName: "Anna", lastName: "A", email });
    const second = await caller.owners.create({ tenantId, firstName: "Anna2", lastName: "A2", email });
    expect(second.id).toBe(first.id);
  });

  it("reactivates inactive owner with same email", async () => {
    const caller = createTestCaller(db, { clerkId, permissions: [PERMISSIONS.PATIENTS_CREATE, PERMISSIONS.PATIENTS_UPDATE] });
    const email = uniqueEmail();
    const created = await caller.owners.create({ tenantId, firstName: "Karl", lastName: "K", email });
    await caller.owners.delete({ id: created.id, tenantId });

    const reactivated = await caller.owners.create({ tenantId, firstName: "Karl2", lastName: "K2", email });
    expect(reactivated.id).toBe(created.id);
    expect(reactivated.active).toBe(true);
  });
});

describe("owners.update", () => {
  it("requires PATIENTS_UPDATE permission", async () => {
    const [owner] = await db.insert(owners).values({ tenantId, firstName: "Test", lastName: "Owner" }).returning();
    const caller = createTestCaller(db, { clerkId, permissions: [] });
    await expect(
      caller.owners.update({ id: owner.id, tenantId, firstName: "New" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("updates owner fields", async () => {
    const [owner] = await db.insert(owners).values({ tenantId, firstName: "Old", lastName: "Name" }).returning();
    const caller = createTestCaller(db, { clerkId, permissions: [PERMISSIONS.PATIENTS_UPDATE] });
    const updated = await caller.owners.update({ id: owner.id, tenantId, firstName: "New" });
    expect(updated.firstName).toBe("New");
  });

  it("returns NOT_FOUND for unknown owner", async () => {
    const caller = createTestCaller(db, { clerkId, permissions: [PERMISSIONS.PATIENTS_UPDATE] });
    await expect(
      caller.owners.update({ id: "00000000-0000-4000-8000-000000000000", tenantId, firstName: "X" })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("owners.list — tenant isolation", () => {
  it("does not return owners from another tenant", async () => {
    const { tenant: other } = await seedTestTenant(db, { clerkId: "other_owner_clerk", slug: "other-owners-praxis" });
    await db.insert(owners).values({ tenantId: other.id, firstName: "Foreign", lastName: "Owner" });

    const caller = createTestCaller(db, { clerkId, permissions: [] });
    const result = await caller.owners.list({ tenantId });
    expect(result.every((o) => o.id !== undefined)).toBe(true);
    // All returned owners belong to our tenant (enforced by query filter)
    const foreignInResult = result.filter((o) => o.firstName === "Foreign" && o.lastName === "Owner");
    expect(foreignInResult).toHaveLength(0);
  });

  it("filters by search term", async () => {
    const email = uniqueEmail();
    await db.insert(owners).values({ tenantId, firstName: "Unique", lastName: "SearchName", email });
    const caller = createTestCaller(db, { clerkId, permissions: [] });
    const result = await caller.owners.list({ tenantId, search: "SearchName" });
    expect(result.some((o) => o.lastName === "SearchName")).toBe(true);
  });
});

describe("owners.merge", () => {
  it("requires PATIENTS_UPDATE permission", async () => {
    const [a] = await db.insert(owners).values({ tenantId, firstName: "A", lastName: "A" }).returning();
    const [b] = await db.insert(owners).values({ tenantId, firstName: "B", lastName: "B" }).returning();
    const caller = createTestCaller(db, { clerkId, permissions: [] });
    await expect(
      caller.owners.merge({ tenantId, targetId: a.id, sourceId: b.id })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("reassigns patients from source to target and deletes source", async () => {
    const [target] = await db.insert(owners).values({ tenantId, firstName: "Target", lastName: "T" }).returning();
    const [source] = await db.insert(owners).values({ tenantId, firstName: "Source", lastName: "S" }).returning();
    await db.insert(patients).values({ tenantId, ownerId: source.id, name: "Pet", species: "Hund" });

    const caller = createTestCaller(db, { clerkId, permissions: [PERMISSIONS.PATIENTS_UPDATE] });
    const result = await caller.owners.merge({ tenantId, targetId: target.id, sourceId: source.id });
    expect(result.success).toBe(true);

    const sourcePets = await db.select().from(patients).where(eq(patients.ownerId, source.id));
    expect(sourcePets).toHaveLength(0);
  });

  it("rejects merge when source equals target", async () => {
    const [owner] = await db.insert(owners).values({ tenantId, firstName: "Same", lastName: "S" }).returning();
    const caller = createTestCaller(db, { clerkId, permissions: [PERMISSIONS.PATIENTS_UPDATE] });
    await expect(
      caller.owners.merge({ tenantId, targetId: owner.id, sourceId: owner.id })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});

describe("owners.delete", () => {
  it("requires PATIENTS_UPDATE permission", async () => {
    const [owner] = await db.insert(owners).values({ tenantId, firstName: "Del", lastName: "D" }).returning();
    const caller = createTestCaller(db, { clerkId, permissions: [] });
    await expect(
      caller.owners.delete({ id: owner.id, tenantId })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("deactivates owner and their patients", async () => {
    const [owner] = await db.insert(owners).values({ tenantId, firstName: "ToDeactivate", lastName: "D", email: uniqueEmail() }).returning();
    await db.insert(patients).values({ tenantId, ownerId: owner.id, name: "Pet", species: "Katze" });

    const caller = createTestCaller(db, { clerkId, permissions: [PERMISSIONS.PATIENTS_UPDATE] });
    const result = await caller.owners.delete({ id: owner.id, tenantId });
    expect(result.success).toBe(true);

    const [updated] = await db.select({ active: owners.active }).from(owners).where(eq(owners.id, owner.id));
    expect(updated.active).toBe(false);
  });
});
