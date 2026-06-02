// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import type { TestDb } from "@/server/__tests__/helpers";
import { appointments, appointmentHolds, owners, patients, roles, tenants, userRoles } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { randomUUID } from "node:crypto";

vi.mock("@/lib/email/service");
vi.mock("@/lib/events/appointment");
vi.mock("@/server/audit");

process.env.JWT_SECRET = "test-secret-at-least-32-chars-long!!";
process.env.SMTP_HOST ??= "localhost";
process.env.SMTP_USER ??= "test-user";
process.env.SMTP_PASS ??= "test-pass";

let createTestDb!: (typeof import("@/server/__tests__/helpers"))["createTestDb"];
let createTestCaller!: (typeof import("@/server/__tests__/helpers"))["createTestCaller"];
let seedTestTenant!: (typeof import("@/server/__tests__/helpers"))["seedTestTenant"];

let db: TestDb;
let adminDb: TestDb;
let cleanup: () => Promise<void>;
let tenantId: string;
let clerkId: string;
let vetUserId: string;
let tenantSlug: string;

const browserSessionId = "00000000-0000-4000-8000-000000000099";

beforeAll(async () => {
  ({ createTestDb, createTestCaller, seedTestTenant } = await import("@/server/__tests__/helpers"));

  ({ db, adminDb, cleanup } = await createTestDb());
  const { tenant, user } = await seedTestTenant(db);
  tenantId = tenant.id;
  tenantSlug = tenant.slug;
  clerkId = user.clerkId;
  vetUserId = user.id;
  await db
    .update(tenants)
    .set({ websiteEnabled: true })
    .where(eq(tenants.id, tenantId));

  const [vetRole] = await db
    .insert(roles)
    .values({
      tenantId,
      code: "vet",
      name: "Vet",
      description: "Veterinarian",
      isSystem: true,
      isEditableByTenant: false,
      baseVersion: 1,
    })
    .returning();

  await db.insert(userRoles).values({ userId: vetUserId, roleId: vetRole.id });
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
    const input = bookInput({ slotStart: new Date("2026-09-01T09:00:00Z"), slotEnd: new Date("2026-09-01T09:30:00Z") });

    const result = await caller.booking.book(input);

    const [appt] = await db.select().from(appointments).where(eq(appointments.id, result.appointmentId));
    expect(appt.status).toBe("pending-confirmation");
    expect(appt.source).toBe("online_booking");
    expect(appt.tenantId).toBe(tenantId);

    const [patient] = await db.select().from(patients).where(eq(patients.id, appt.patientId));
    expect(patient.name).toBe("Bello");

    const [owner] = await db.select().from(owners).where(eq(owners.id, patient.ownerId));
    expect(owner.email).toBe(input.owner.email);
  });

  it("cleans up holds for browser session after successful booking", async () => {
    // Insert a hold
    await db.insert(appointmentHolds).values({
      tenantId,
      browserSessionId,
      sessionToken: "00000000-0000-4000-8000-000000000001",
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
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
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
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("public booking access guards", () => {
  it("returns clinic data for enabled tenant and hides disabled tenants without valid preview", async () => {
    const anonCaller = createTestCaller(db, { clerkId: "", permissions: [], adminDb });

    const enabledClinic = await anonCaller.booking.getClinic({ slug: tenantSlug });
    expect(enabledClinic?.id).toBe(tenantId);

    const { tenant: disabledTenant } = await seedTestTenant(db, {
      clerkId: `disabled_clerk_${Date.now()}`,
      slug: `disabled-${Date.now()}`,
    });
    await db
      .update(tenants)
      .set({ websiteEnabled: false, previewToken: "preview-token-123" })
      .where(eq(tenants.id, disabledTenant.id));

    const hiddenWithoutPreview = await anonCaller.booking.getClinic({ slug: disabledTenant.slug });
    expect(hiddenWithoutPreview).toBeNull();

    const hiddenWithInvalidPreview = await anonCaller.booking.getClinic({
      slug: disabledTenant.slug,
      previewToken: "wrong-token",
    });
    expect(hiddenWithInvalidPreview).toBeNull();

    const visibleWithValidPreview = await anonCaller.booking.getClinic({
      slug: disabledTenant.slug,
      previewToken: "preview-token-123",
    });
    expect(visibleWithValidPreview?.id).toBe(disabledTenant.id);
  });

  it("public booking procedures require enabled tenant or matching preview token", async () => {
    const anonCaller = createTestCaller(db, { clerkId: "", permissions: [], adminDb });

    const enabledVets = await anonCaller.booking.listPublicVets({ tenantId });
    expect(enabledVets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: vetUserId }),
      ])
    );

    const { tenant: disabledTenant, user: disabledUser } = await seedTestTenant(db, {
      clerkId: `disabled_proc_clerk_${Date.now()}`,
      slug: `disabled-proc-${Date.now()}`,
    });
    await db
      .update(tenants)
      .set({ websiteEnabled: false, previewToken: "preview-token-proc-123" })
      .where(eq(tenants.id, disabledTenant.id));

    const [disabledVetRole] = await db
      .insert(roles)
      .values({
        tenantId: disabledTenant.id,
        code: "vet",
        name: "Vet",
        description: "Veterinarian",
        isSystem: true,
        isEditableByTenant: false,
        baseVersion: 1,
      })
      .returning();

    await db.insert(userRoles).values({ userId: disabledUser.id, roleId: disabledVetRole.id });

    await expect(
      anonCaller.booking.listPublicVets({ tenantId: disabledTenant.id })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    await expect(
      anonCaller.booking.listPublicVets({
        tenantId: disabledTenant.id,
        previewToken: "wrong-token",
      })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    const allowedWithValidPreview = await anonCaller.booking.listPublicVets({
      tenantId: disabledTenant.id,
      previewToken: "preview-token-proc-123",
    });
    expect(allowedWithValidPreview).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: disabledUser.id }),
      ])
    );
  });

  it("rejects arbitrary tenant IDs in public booking procedures", async () => {
    const anonCaller = createTestCaller(db, { clerkId: "", permissions: [], adminDb });

    await expect(
      anonCaller.booking.listPublicVets({ tenantId: randomUUID() })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
