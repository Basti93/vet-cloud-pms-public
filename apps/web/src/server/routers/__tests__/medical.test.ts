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
let vetUserId: string;
let patientId: string;

beforeAll(async () => {
  ({ db, cleanup } = await createTestDb());
  const { tenant, user } = await seedTestTenant(db);
  tenantId = tenant.id;
  clerkId = user.clerkId;
  vetUserId = user.id;

  const [owner] = await db.insert(owners).values({ tenantId, firstName: "Max", lastName: "Muster" }).returning();
  const [patient] = await db.insert(patients).values({ tenantId, ownerId: owner.id, name: "Bello", species: "Hund" }).returning();
  patientId = patient.id;
}, 60_000);

afterAll(async () => {
  await cleanup?.();
});

// Regression test for known bug: list procedures lacked MEDICAL_READ guard.
// Any authenticated tenant user (including Receptionist) could read medical records.
describe("medical.diagnoses.list — MEDICAL_READ guard", () => {
  it("throws FORBIDDEN without MEDICAL_READ permission", async () => {
    const caller = createTestCaller(db, { clerkId, permissions: [] });
    await expect(
      caller.medical.diagnoses.list({ patientId, tenantId })
    ).rejects.toThrow("FORBIDDEN");
  });

  it("returns records with MEDICAL_READ permission", async () => {
    const caller = createTestCaller(db, {
      clerkId,
      permissions: [PERMISSIONS.MEDICAL_READ],
    });
    const result = await caller.medical.diagnoses.list({ patientId, tenantId });
    expect(Array.isArray(result)).toBe(true);
  });
});

describe("medical.medications.list — MEDICAL_READ guard", () => {
  it("throws FORBIDDEN without MEDICAL_READ permission", async () => {
    const caller = createTestCaller(db, { clerkId, permissions: [] });
    await expect(
      caller.medical.medications.list({ patientId, tenantId })
    ).rejects.toThrow("FORBIDDEN");
  });

  it("returns records with MEDICAL_READ permission", async () => {
    const caller = createTestCaller(db, {
      clerkId,
      permissions: [PERMISSIONS.MEDICAL_READ],
    });
    const result = await caller.medical.medications.list({ patientId, tenantId });
    expect(Array.isArray(result)).toBe(true);
  });
});

describe("medical.vitals.list — MEDICAL_READ guard", () => {
  it("throws FORBIDDEN without MEDICAL_READ permission", async () => {
    const caller = createTestCaller(db, { clerkId, permissions: [] });
    await expect(
      caller.medical.vitals.list({ patientId, tenantId })
    ).rejects.toThrow("FORBIDDEN");
  });

  it("returns records with MEDICAL_READ permission", async () => {
    const caller = createTestCaller(db, {
      clerkId,
      permissions: [PERMISSIONS.MEDICAL_READ],
    });
    const result = await caller.medical.vitals.list({ patientId, tenantId });
    expect(Array.isArray(result)).toBe(true);
  });
});

describe("medical.diagnoses.create — MEDICAL_CREATE guard", () => {
  it("throws FORBIDDEN without MEDICAL_CREATE permission", async () => {
    const caller = createTestCaller(db, {
      clerkId,
      permissions: [PERMISSIONS.MEDICAL_READ],
    });
    await expect(
      caller.medical.diagnoses.create({
        tenantId,
        patientId,
        title: "Otitis",
        status: "active",
        dateOfDiagnosis: new Date("2026-05-01"),
      })
    ).rejects.toThrow("FORBIDDEN");
  });

  it("creates diagnosis with MEDICAL_CREATE permission", async () => {
    const caller = createTestCaller(db, {
      clerkId,
      permissions: [PERMISSIONS.MEDICAL_READ, PERMISSIONS.MEDICAL_CREATE],
    });
    const result = await caller.medical.diagnoses.create({
      tenantId,
      patientId,
      title: "Otitis Externa",
      status: "active",
      dateOfDiagnosis: new Date("2026-05-01"),
    });
    expect(result).toHaveProperty("id");
    expect(result.title).toBe("Otitis Externa");
  });
});
