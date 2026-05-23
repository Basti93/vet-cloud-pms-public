// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { createTestDb, createTestCaller, seedTestTenant, type TestDb } from "@/server/__tests__/helpers";
import { appointments, appointmentHolds, owners, patients } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

vi.mock("@/lib/email/service");
vi.mock("@/lib/events/appointment");
vi.mock("@/server/audit");

process.env.JWT_SECRET = "test-secret-at-least-32-chars-long!!";

let db: TestDb;
let cleanup: () => Promise<void>;
let tenantId: string;
let clerkId: string;
let vetUserId: string;

const browserSessionId = "00000000-0000-0000-0000-000000000099";

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

let ownerEmailCounter = 0;
function bookInput(overrides: Record<string, unknown> = {}) {
  return {
    tenantId,
    slotStart: new Date("2026-09-01T09:00:00Z"),
    slotEnd: new Date("2026-09-01T09:30:00Z"),
    reason: "Impfung",
    patient: { name: "Bello", species: "Hund" },
    owner: { firstName: "Max", lastName: "Muster", email: `max${++ownerEmailCounter}@muster.de`, phone: "+49123456789" },
    vetId: vetUserId,
    browserSessionId,
    ...overrides,
  };
}

describe("booking.book", () => {
  it("creates owner + patient + appointment atomically with pending-confirmation status", async () => {
    const caller = createTestCaller(db, { clerkId: "", permissions: [] });

    const result = await caller.booking.book(bookInput({ slotStart: new Date("2026-09-01T09:00:00Z"), slotEnd: new Date("2026-09-01T09:30:00Z") }));

    const [appt] = await db.select().from(appointments).where(eq(appointments.id, result.appointmentId));
    expect(appt.status).toBe("pending-confirmation");
    expect(appt.source).toBe("online_booking");
    expect(appt.tenantId).toBe(tenantId);

    const [patient] = await db.select().from(patients).where(eq(patients.id, appt.patientId));
    expect(patient.name).toBe("Bello");

    const [owner] = await db.select().from(owners).where(eq(owners.id, patient.ownerId));
    expect(owner.email).toBe("max@muster.de");
  });

  it("cleans up holds for browser session after successful booking", async () => {
    // Insert a hold
    await db.insert(appointmentHolds).values({
      tenantId,
      browserSessionId,
      sessionToken: "00000000-0000-0000-0000-000000000001",
      slotDatetime: new Date("2026-09-02T09:00:00Z"),
      vetId: vetUserId,
      expiresAt: new Date(Date.now() + 60_000),
    });

    const caller = createTestCaller(db, { clerkId: "", permissions: [] });
    await caller.booking.book(bookInput({ slotStart: new Date("2026-09-02T09:00:00Z"), slotEnd: new Date("2026-09-02T09:30:00Z") }));

    const holds = await db.select().from(appointmentHolds).where(
      and(eq(appointmentHolds.tenantId, tenantId), eq(appointmentHolds.browserSessionId, browserSessionId))
    );
    expect(holds).toHaveLength(0);
  });

  it("rejects slot in the past", async () => {
    const caller = createTestCaller(db, { clerkId: "", permissions: [] });
    await expect(
      caller.booking.book(bookInput({ slotStart: new Date("2020-01-01T09:00:00Z"), slotEnd: new Date("2020-01-01T09:30:00Z") }))
    ).rejects.toThrow("BAD_REQUEST");
  });
});

describe("booking.confirm", () => {
  it("sets status to confirmed for pending-confirmation appointment", async () => {
    const [owner] = await db.insert(owners).values({ tenantId, firstName: "Anna", lastName: "Müller", email: "anna@test.de" }).returning();
    const [patient] = await db.insert(patients).values({ tenantId, ownerId: owner.id, name: "Minka", species: "Katze" }).returning();
    const [appt] = await db
      .insert(appointments)
      .values({ tenantId, patientId: patient.id, vetId: vetUserId, startTime: new Date("2026-10-01T09:00:00Z"), endTime: new Date("2026-10-01T09:30:00Z"), title: "Online", source: "online_booking", status: "pending-confirmation" })
      .returning();

    const caller = createTestCaller(db, { clerkId, permissions: [] });
    await caller.booking.confirm({ appointmentId: appt.id, tenantId });

    const [updated] = await db.select({ status: appointments.status }).from(appointments).where(eq(appointments.id, appt.id));
    expect(updated.status).toBe("confirmed");
  });

  it("sets status to confirmed for already-scheduled (owner-confirmed) appointment", async () => {
    const [owner] = await db.insert(owners).values({ tenantId, firstName: "Karl", lastName: "Schmidt", email: "karl@test.de" }).returning();
    const [patient] = await db.insert(patients).values({ tenantId, ownerId: owner.id, name: "Rex", species: "Hund" }).returning();
    const [appt] = await db
      .insert(appointments)
      .values({ tenantId, patientId: patient.id, vetId: vetUserId, startTime: new Date("2026-10-02T09:00:00Z"), endTime: new Date("2026-10-02T09:30:00Z"), title: "Online", source: "online_booking", status: "scheduled" })
      .returning();

    const caller = createTestCaller(db, { clerkId, permissions: [] });
    await caller.booking.confirm({ appointmentId: appt.id, tenantId });

    const [updated] = await db.select({ status: appointments.status }).from(appointments).where(eq(appointments.id, appt.id));
    expect(updated.status).toBe("confirmed");
  });

  it("returns NOT_FOUND for non-online-booking appointment", async () => {
    const [owner] = await db.insert(owners).values({ tenantId, firstName: "Lisa", lastName: "Braun", email: "lisa@test.de" }).returning();
    const [patient] = await db.insert(patients).values({ tenantId, ownerId: owner.id, name: "Goldie", species: "Hund" }).returning();
    const [appt] = await db
      .insert(appointments)
      .values({ tenantId, patientId: patient.id, vetId: vetUserId, startTime: new Date("2026-10-03T09:00:00Z"), endTime: new Date("2026-10-03T09:30:00Z"), title: "Manual", source: "manual", status: "scheduled" })
      .returning();

    const caller = createTestCaller(db, { clerkId, permissions: [] });
    await expect(
      caller.booking.confirm({ appointmentId: appt.id, tenantId })
    ).rejects.toThrow("NOT_FOUND");
  });

  it("deduplicates owner when confirming pending-confirmation with existing owner email", async () => {
    // Existing owner
    await db.insert(owners).values({ tenantId, firstName: "Existing", lastName: "Owner", email: "dedup@test.de" });
    // Provisional owner (from online booking) — same email
    const [provisionalOwner] = await db.insert(owners).values({ tenantId, firstName: "Provisional", lastName: "Owner", email: "dedup@test.de" }).returning();
    const [provisionalPatient] = await db.insert(patients).values({ tenantId, ownerId: provisionalOwner.id, name: "Buddy", species: "Hund" }).returning();
    const [appt] = await db
      .insert(appointments)
      .values({ tenantId, patientId: provisionalPatient.id, vetId: vetUserId, startTime: new Date("2026-10-04T09:00:00Z"), endTime: new Date("2026-10-04T09:30:00Z"), title: "Online dedup", source: "online_booking", status: "pending-confirmation" })
      .returning();

    const caller = createTestCaller(db, { clerkId, permissions: [] });
    await caller.booking.confirm({ appointmentId: appt.id, tenantId });

    // Provisional owner should be merged/deleted
    const [remaining] = await db.select().from(owners).where(eq(owners.id, provisionalOwner.id));
    expect(remaining).toBeUndefined();

    // Appointment should be confirmed and repointed to existing owner's patient
    const [updated] = await db.select({ status: appointments.status, patientId: appointments.patientId }).from(appointments).where(eq(appointments.id, appt.id));
    expect(updated.status).toBe("confirmed");
    expect(updated.patientId).not.toBe(provisionalPatient.id);
  });
});
