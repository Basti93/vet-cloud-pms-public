// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { createTestDb, createTestCaller, seedTestTenant, type TestDb } from "@/server/__tests__/helpers";
import { PERMISSIONS, owners, patients } from "@/lib/db/schema";

vi.mock("@/lib/email/service");
vi.mock("@/lib/events/appointment");
vi.mock("@/server/audit");

let db: TestDb;
let cleanup: () => Promise<void>;
let tenantId: string;
let clerkId: string;
let ownerId: string;

beforeAll(async () => {
  ({ db, cleanup } = await createTestDb());
  const { tenant, user } = await seedTestTenant(db);
  tenantId = tenant.id;
  clerkId = user.clerkId;
  const [owner] = await db.insert(owners).values({ tenantId, firstName: "Max", lastName: "Muster" }).returning();
  ownerId = owner.id;
}, 60_000);

afterAll(async () => {
  await cleanup?.();
});

describe("patients.create", () => {
  it("requires PATIENTS_CREATE permission", async () => {
    const caller = createTestCaller(db, { clerkId, permissions: [] });
    await expect(
      caller.patients.create({ tenantId, ownerId, name: "Bello", species: "Hund" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("creates patient under existing owner", async () => {
    const caller = createTestCaller(db, { clerkId, permissions: [PERMISSIONS.PATIENTS_CREATE] });
    const result = await caller.patients.create({ tenantId, ownerId, name: "Rex", species: "Hund" });
    expect(result.patient.name).toBe("Rex");
    expect(result.patient.tenantId).toBe(tenantId);
    expect(result.owner.id).toBe(ownerId);
  });

  it("returns NOT_FOUND when owner does not exist", async () => {
    const caller = createTestCaller(db, { clerkId, permissions: [PERMISSIONS.PATIENTS_CREATE] });
    await expect(
      caller.patients.create({ tenantId, ownerId: "00000000-0000-4000-8000-000000000000", name: "Ghost", species: "Katze" })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("patients.byId", () => {
  it("returns patient with owner", async () => {
    const [patient] = await db.insert(patients).values({ tenantId, ownerId, name: "Minka", species: "Katze" }).returning();
    const caller = createTestCaller(db, { clerkId, permissions: [] });
    const result = await caller.patients.byId({ id: patient.id, tenantId });
    expect(result.patients.name).toBe("Minka");
  });

  it("returns NOT_FOUND for unknown patient", async () => {
    const caller = createTestCaller(db, { clerkId, permissions: [] });
    await expect(
      caller.patients.byId({ id: "00000000-0000-4000-8000-000000000001", tenantId })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("patients.list — tenant isolation", () => {
  it("does not return patients from another tenant", async () => {
    const { tenant: other } = await seedTestTenant(db, { clerkId: "other_patients_clerk", slug: "other-patients-praxis" });
    const [otherOwner] = await db.insert(owners).values({ tenantId: other.id, firstName: "Foreign", lastName: "O" }).returning();
    await db.insert(patients).values({ tenantId: other.id, ownerId: otherOwner.id, name: "ForeignPet", species: "Hund" });

    const caller = createTestCaller(db, { clerkId, permissions: [] });
    const result = await caller.patients.list({ tenantId });
    expect(result.every((p) => p.id !== undefined)).toBe(true);
    expect(result.some((p) => p.name === "ForeignPet")).toBe(false);
  });

  it("filters by name search", async () => {
    await db.insert(patients).values({ tenantId, ownerId, name: "UniquePetNameXYZ", species: "Hund" });
    const caller = createTestCaller(db, { clerkId, permissions: [] });
    const result = await caller.patients.list({ tenantId, search: "UniquePetNameXYZ" });
    expect(result.some((p) => p.name === "UniquePetNameXYZ")).toBe(true);
  });
});
