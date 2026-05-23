// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { createTestDb, createTestCaller, seedTestTenant, type TestDb } from "@/server/__tests__/helpers";
import { PERMISSIONS, owners, patients, appointments } from "@/lib/db/schema";
import { generateConfirmationToken } from "@/lib/tokens/confirmation";
import { eq, and } from "drizzle-orm";

vi.mock("@/lib/email/service");
vi.mock("@/lib/events/appointment");
vi.mock("@/server/audit");

// JWT_SECRET required by generateConfirmationToken
process.env.JWT_SECRET = "test-secret-at-least-32-chars-long!!";

let db: TestDb;
let cleanup: () => Promise<void>;
let tenantId: string;
let clerkId: string;
let vetUserId: string;

async function seedPatient(ownerId: string) {
  const [patient] = await db
    .insert(patients)
    .values({ tenantId, ownerId, name: "Bello", species: "Hund" })
    .returning();
  return patient;
}

async function seedOwner() {
  const [owner] = await db
    .insert(owners)
    .values({ tenantId, firstName: "Max", lastName: "Muster", email: "max@muster.de" })
    .returning();
  return owner;
}

beforeAll(async () => {
  ({ db, cleanup } = await createTestDb());
  const { tenant, user } = await seedTestTenant(db);
  tenantId = tenant.id;
  clerkId = user.clerkId;
  vetUserId = user.id;
}, 60_000);

afterAll(async () => {
  await cleanup?.();
});

describe("appointments.create", () => {
  it("requires APPOINTMENTS_CREATE permission", async () => {
    const owner = await seedOwner();
    const patient = await seedPatient(owner.id);
    const caller = createTestCaller(db, { clerkId, permissions: [] });

    await expect(
      caller.appointments.create({
        tenantId,
        patientId: patient.id,
        vetId: vetUserId,
        startTime: new Date("2026-06-01T09:00:00Z"),
        endTime: new Date("2026-06-01T09:30:00Z"),
        title: "Impfung",
      })
    ).rejects.toThrow("FORBIDDEN");
  });

  it("creates appointment with status scheduled", async () => {
    const owner = await seedOwner();
    const patient = await seedPatient(owner.id);
    const caller = createTestCaller(db, {
      clerkId,
      permissions: [PERMISSIONS.APPOINTMENTS_CREATE],
    });

    const result = await caller.appointments.create({
      tenantId,
      patientId: patient.id,
      vetId: vetUserId,
      startTime: new Date("2026-06-02T09:00:00Z"),
      endTime: new Date("2026-06-02T09:30:00Z"),
      title: "Impfung",
    });

    expect(result.status).toBe("scheduled");
    expect(result.tenantId).toBe(tenantId);
    expect(result.patientId).toBe(patient.id);
  });
});

describe("appointments.update", () => {
  it("requires APPOINTMENTS_UPDATE permission", async () => {
    const owner = await seedOwner();
    const patient = await seedPatient(owner.id);
    const [appt] = await db
      .insert(appointments)
      .values({ tenantId, patientId: patient.id, vetId: vetUserId, startTime: new Date("2026-06-03T09:00:00Z"), endTime: new Date("2026-06-03T09:30:00Z"), title: "Test", status: "scheduled" })
      .returning();

    const caller = createTestCaller(db, { clerkId, permissions: [] });
    await expect(
      caller.appointments.update({ id: appt.id, tenantId, status: "confirmed" })
    ).rejects.toThrow("FORBIDDEN");
  });

  it("transitions status scheduled → confirmed → completed", async () => {
    const owner = await seedOwner();
    const patient = await seedPatient(owner.id);
    const [appt] = await db
      .insert(appointments)
      .values({ tenantId, patientId: patient.id, vetId: vetUserId, startTime: new Date("2026-06-04T09:00:00Z"), endTime: new Date("2026-06-04T09:30:00Z"), title: "Test", status: "scheduled" })
      .returning();

    const caller = createTestCaller(db, {
      clerkId,
      permissions: [PERMISSIONS.APPOINTMENTS_UPDATE],
    });

    const confirmed = await caller.appointments.update({ id: appt.id, tenantId, status: "confirmed" });
    expect(confirmed.status).toBe("confirmed");

    const completed = await caller.appointments.update({ id: appt.id, tenantId, status: "completed" });
    expect(completed.status).toBe("completed");
  });

  it("returns NOT_FOUND for appointment from another tenant", async () => {
    const { tenant: otherTenant } = await seedTestTenant(db, {
      clerkId: "other_clerk_user",
      slug: "other-praxis",
    });
    const [otherOwner] = await db
      .insert(owners)
      .values({ tenantId: otherTenant.id, firstName: "Other", lastName: "Owner" })
      .returning();
    const [otherPatient] = await db
      .insert(patients)
      .values({ tenantId: otherTenant.id, ownerId: otherOwner.id, name: "Whiskers", species: "Katze" })
      .returning();
    const [otherAppt] = await db
      .insert(appointments)
      .values({ tenantId: otherTenant.id, patientId: otherPatient.id, vetId: vetUserId, startTime: new Date("2026-06-05T09:00:00Z"), endTime: new Date("2026-06-05T09:30:00Z"), title: "Test" })
      .returning();

    const caller = createTestCaller(db, {
      clerkId,
      permissions: [PERMISSIONS.APPOINTMENTS_UPDATE],
    });

    // input.tenantId must match the authenticated user's tenantId → rejected before even hitting the DB
    await expect(
      caller.appointments.update({ id: otherAppt.id, tenantId: otherTenant.id, status: "confirmed" })
    ).rejects.toThrow();
  });
});

describe("appointments.delete", () => {
  it("requires APPOINTMENTS_CANCEL permission", async () => {
    const owner = await seedOwner();
    const patient = await seedPatient(owner.id);
    const [appt] = await db
      .insert(appointments)
      .values({ tenantId, patientId: patient.id, vetId: vetUserId, startTime: new Date("2026-06-06T09:00:00Z"), endTime: new Date("2026-06-06T09:30:00Z"), title: "Test" })
      .returning();

    const caller = createTestCaller(db, { clerkId, permissions: [] });
    await expect(
      caller.appointments.delete({ id: appt.id, tenantId })
    ).rejects.toThrow("FORBIDDEN");
  });

  it("returns NOT_FOUND for unknown appointment", async () => {
    const caller = createTestCaller(db, {
      clerkId,
      permissions: [PERMISSIONS.APPOINTMENTS_CANCEL],
    });
    await expect(
      caller.appointments.delete({ id: "00000000-0000-0000-0000-000000000000", tenantId })
    ).rejects.toThrow("NOT_FOUND");
  });
});

describe("appointments.listByPatient", () => {
  it("returns only appointments for the given patient", async () => {
    const owner = await seedOwner();
    const p1 = await seedPatient(owner.id);
    const p2 = await seedPatient(owner.id);

    await db.insert(appointments).values([
      { tenantId, patientId: p1.id, vetId: vetUserId, startTime: new Date("2026-07-01T09:00:00Z"), endTime: new Date("2026-07-01T09:30:00Z"), title: "P1 appt" },
      { tenantId, patientId: p2.id, vetId: vetUserId, startTime: new Date("2026-07-02T09:00:00Z"), endTime: new Date("2026-07-02T09:30:00Z"), title: "P2 appt" },
    ]);

    const caller = createTestCaller(db, { clerkId, permissions: [] });
    const results = await caller.appointments.listByPatient({ patientId: p1.id, tenantId });

    expect(results.every((a) => a.patientId === p1.id)).toBe(true);
    expect(results.some((a) => a.patientId === p2.id)).toBe(false);
  });
});

describe("appointments.confirmFromEmail", () => {
  it("sets status to scheduled with valid token and owner email", async () => {
    const owner = await seedOwner();
    const patient = await seedPatient(owner.id);
    const [appt] = await db
      .insert(appointments)
      .values({ tenantId, patientId: patient.id, vetId: vetUserId, startTime: new Date("2026-08-01T09:00:00Z"), endTime: new Date("2026-08-01T09:30:00Z"), title: "Online booking", source: "online_booking", status: "pending-confirmation" })
      .returning();

    const token = generateConfirmationToken(appt.id, "max@muster.de", "confirm");

    const publicCaller = createTestCaller(db, { clerkId: "", permissions: [] });
    const result = await publicCaller.appointments.confirmFromEmail({ appointmentId: appt.id, token });
    expect(result.success).toBe(true);

    const [updated] = await db.select({ status: appointments.status }).from(appointments).where(eq(appointments.id, appt.id));
    expect(updated.status).toBe("scheduled");
  });

  it("throws UNAUTHORIZED for invalid token", async () => {
    const owner = await seedOwner();
    const patient = await seedPatient(owner.id);
    const [appt] = await db
      .insert(appointments)
      .values({ tenantId, patientId: patient.id, vetId: vetUserId, startTime: new Date("2026-08-02T09:00:00Z"), endTime: new Date("2026-08-02T09:30:00Z"), title: "Online booking", source: "online_booking", status: "pending-confirmation" })
      .returning();

    const publicCaller = createTestCaller(db, { clerkId: "", permissions: [] });
    await expect(
      publicCaller.appointments.confirmFromEmail({ appointmentId: appt.id, token: "invalid-token" })
    ).rejects.toThrow("UNAUTHORIZED");
  });

  it("deduplicates owner when email matches existing owner", async () => {
    // Existing owner with same email already in DB
    const existingOwner = await seedOwner(); // email: max@muster.de

    // Provisional owner (created during online booking) — same email
    const [provisionalOwner] = await db
      .insert(owners)
      .values({ tenantId, firstName: "Provisional", lastName: "Owner", email: "max@muster.de" })
      .returning();
    const [provisionalPatient] = await db
      .insert(patients)
      .values({ tenantId, ownerId: provisionalOwner.id, name: "Bello", species: "Hund" })
      .returning();
    const [appt] = await db
      .insert(appointments)
      .values({ tenantId, patientId: provisionalPatient.id, vetId: vetUserId, startTime: new Date("2026-08-03T09:00:00Z"), endTime: new Date("2026-08-03T09:30:00Z"), title: "Dedup test", source: "online_booking", status: "pending-confirmation" })
      .returning();

    const token = generateConfirmationToken(appt.id, "max@muster.de", "confirm");
    const publicCaller = createTestCaller(db, { clerkId: "", permissions: [] });
    await publicCaller.appointments.confirmFromEmail({ appointmentId: appt.id, token });

    // Provisional owner should be deleted; appointment repointed to existing owner's patient
    const [updatedAppt] = await db.select({ patientId: appointments.patientId }).from(appointments).where(eq(appointments.id, appt.id));
    const [remaningProvisional] = await db.select().from(owners).where(eq(owners.id, provisionalOwner.id));

    expect(remaningProvisional).toBeUndefined();
    expect(updatedAppt.patientId).not.toBe(provisionalPatient.id);
  });
});
