// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { createTestDb, createTestCaller, seedTestTenant, type TestDb } from "@/server/__tests__/helpers";

vi.mock("@/lib/email/service");
vi.mock("@/lib/events/appointment");
vi.mock("@/server/audit");

let db: TestDb;
let cleanup: () => Promise<void>;
let tenantId: string;
let clerkId: string;
let vetUserId: string;

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

const daySlot = { startHour: 9, startMin: 0, endHour: 17, endMin: 0 };

describe("schedule.getConsultationHours / updateConsultationHours", () => {
  it("returns consultation hours (fallback to defaults on empty)", async () => {
    const caller = createTestCaller(db, { clerkId, permissions: [] });
    const result = await caller.schedule.getConsultationHours({ tenantId });
    expect(Array.isArray(result)).toBe(true);
  });

  it("persists updated consultation hours", async () => {
    const caller = createTestCaller(db, { clerkId, permissions: [] });
    await caller.schedule.updateConsultationHours({
      tenantId,
      hours: [{ dayOfWeek: 1, slots: [daySlot] }],
    });
    const result = await caller.schedule.getConsultationHours({ tenantId });
    const monday = result.find((d) => d.dayOfWeek === 1);
    expect(monday?.slots).toHaveLength(1);
    expect(monday?.slots[0].startHour).toBe(9);
  });
});

describe("schedule.getPracticeHours / updatePracticeHours", () => {
  it("returns practice hours (fallback to defaults on empty)", async () => {
    const caller = createTestCaller(db, { clerkId, permissions: [] });
    const result = await caller.schedule.getPracticeHours({ tenantId });
    expect(Array.isArray(result)).toBe(true);
  });

  it("persists updated practice hours", async () => {
    const caller = createTestCaller(db, { clerkId, permissions: [] });
    await caller.schedule.updatePracticeHours({
      tenantId,
      hours: [{ dayOfWeek: 2, slots: [daySlot] }],
    });
    const result = await caller.schedule.getPracticeHours({ tenantId });
    const tuesday = result.find((d) => d.dayOfWeek === 2);
    expect(tuesday?.slots).toHaveLength(1);
  });
});

describe("schedule.getSpecialOpeningHours / updateSpecialOpeningHours", () => {
  it("returns empty array when no special hours set", async () => {
    const caller = createTestCaller(db, { clerkId, permissions: [] });
    const result = await caller.schedule.getSpecialOpeningHours({ tenantId });
    expect(Array.isArray(result)).toBe(true);
  });

  it("persists special opening hours entry", async () => {
    const caller = createTestCaller(db, { clerkId, permissions: [] });
    await caller.schedule.updateSpecialOpeningHours({
      tenantId,
      entries: [{
        id: "holiday-2026",
        title: "Weihnachten",
        startsOn: "2026-12-24",
        endsOn: "2026-12-26",
        rows: [{ days: "Mo–Fr", time: "Geschlossen" }],
      }],
    });
    const result = await caller.schedule.getSpecialOpeningHours({ tenantId });
    expect(result.some((e) => e.id === "holiday-2026")).toBe(true);
  });

  it("rejects entry where endDate is before startDate", async () => {
    const caller = createTestCaller(db, { clerkId, permissions: [] });
    await expect(
      caller.schedule.updateSpecialOpeningHours({
        tenantId,
        entries: [{
          id: "bad-range",
          title: "Bad Range",
          startsOn: "2026-12-26",
          endsOn: "2026-12-24",
          rows: [{ days: "Mo", time: "Geschlossen" }],
        }],
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});

describe("schedule.upsertVetDaySchedule", () => {
  it("inserts vet day schedule and updates on second call", async () => {
    const { vetSchedules } = await import("@/lib/db/schema");
    const { eq, and } = await import("drizzle-orm");
    const caller = createTestCaller(db, { clerkId, permissions: [] });
    await caller.schedule.upsertVetDaySchedule({
      tenantId,
      vetId: vetUserId,
      dayOfWeek: 1,
      slots: [daySlot],
    });

    // second call should update, not insert duplicate
    const result = await caller.schedule.upsertVetDaySchedule({
      tenantId,
      vetId: vetUserId,
      dayOfWeek: 1,
      slots: [{ startHour: 8, startMin: 0, endHour: 16, endMin: 0 }],
    });
    expect(result.success).toBe(true);

    // Verify DB directly — user has no VET role so getVetSchedules filters them out
    const rows = await db
      .select()
      .from(vetSchedules)
      .where(and(eq(vetSchedules.vetId, vetUserId), eq(vetSchedules.dayOfWeek, 1)));
    expect(rows).toHaveLength(1);
    const slots = rows[0].slots as { startHour: number }[];
    expect(slots[0].startHour).toBe(8);
  });
});

describe("schedule.createAbsence / deleteAbsence", () => {
  it("creates absence and deletes it", async () => {
    const caller = createTestCaller(db, { clerkId, permissions: [] });
    const created = await caller.schedule.createAbsence({
      tenantId,
      vetId: vetUserId,
      startDate: "2027-01-10",
      endDate: "2027-01-15",
      type: "vacation",
    });
    expect(created.id).toBeTruthy();

    const result = await caller.schedule.deleteAbsence({ tenantId, absenceId: created.id });
    expect(result.success).toBe(true);
  });

  it("rejects absence where endDate is before startDate", async () => {
    const caller = createTestCaller(db, { clerkId, permissions: [] });
    await expect(
      caller.schedule.createAbsence({
        tenantId,
        vetId: vetUserId,
        startDate: "2027-01-15",
        endDate: "2027-01-10",
        type: "sick",
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});

describe("schedule.updateVetSlotDuration", () => {
  it("updates slot duration for vet", async () => {
    const caller = createTestCaller(db, { clerkId, permissions: [] });
    const result = await caller.schedule.updateVetSlotDuration({
      tenantId,
      vetId: vetUserId,
      slotDurationMin: 45,
    });
    expect(result.success).toBe(true);
  });
});
