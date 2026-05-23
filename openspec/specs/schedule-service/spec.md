# Schedule Service

`apps/web/src/server/routers/booking.ts` is 1315 lines. It mixes tRPC presentation logic
(input parsing, context plumbing, error shaping) with scheduling domain logic (timezone math,
slot overlap detection, vet fair-distribution assignment, opening-hour fallbacks).

Domain logic is untestable without a full tRPC context. `booking-core.ts` (79 lines) holds
some pure functions but the router re-implements timezone and slot-filtering logic inline
instead of delegating.

## Requirements

### Requirement: Scheduling domain logic lives behind a single module interface
All logic that computes available slots, reserves slots, or applies scheduling rules SHALL
reside in a `ScheduleService` module. The booking tRPC router SHALL delegate to
`ScheduleService` and contain no inline timezone math, overlap detection, or vet-assignment
logic.

#### Scenario: Available slots query
- **WHEN** `scheduleService.getAvailableSlots(params)` is called with a tenant, vet, date
  range, and slot duration
- **THEN** it returns `BookingSlot[]` filtered for past slots, booked appointments, and holds
- **AND** slots are in UTC with timezone conversion applied internally

#### Scenario: Vet assignment
- **WHEN** `scheduleService.selectVet(tenantId, date)` is called
- **THEN** it returns the vet ID with the fewest appointments (fair distribution)
- **AND** throws if no vets are available

#### Scenario: Booking router is thin
- **WHEN** `apps/web/src/server/routers/booking.ts` is read
- **THEN** no function longer than 30 lines exists in the file
- **AND** no timezone conversion (`toLocaleString`, `Intl`, `zonedToUtc`) appears outside of `ScheduleService`

### Requirement: ScheduleService is testable without tRPC context
The `ScheduleService` interface SHALL accept plain parameters (no `ctx`, no tRPC types).
All database access SHALL go through an injectable dependency so tests can substitute an
in-memory adapter.

#### Scenario: Unit test without database
- **WHEN** a test constructs `ScheduleService` with an in-memory slot store
- **THEN** `getAvailableSlots` returns the correct filtered slots without any database connection

## Proposed Interface

```typescript
// apps/web/src/server/schedule-service.ts

export interface GetAvailableSlotsParams {
  tenantId: string;
  vetId: string;
  localDateStr: string;        // "YYYY-MM-DD" in clinic timezone
  timezone: string;             // IANA timezone, e.g. "Europe/Berlin"
  slotDurationMin?: number;     // default 30
}

export interface ReserveSlotParams {
  tenantId: string;
  vetId: string;
  slotStart: Date;
  durationMin: number;
  holdTtlMin?: number;          // default 10
}

export interface ScheduleServiceDeps {
  /** Fetch booked appointments for a vet on a date (UTC range) */
  getBookedIntervals(tenantId: string, vetId: string, from: Date, to: Date): Promise<AppointmentInterval[]>;
  /** Fetch active holds for a vet on a date */
  getActiveHolds(tenantId: string, vetId: string, from: Date, to: Date): Promise<SlotHold[]>;
  /** Fetch vets with appointment counts for fair distribution */
  getVetsWithCounts(tenantId: string): Promise<Array<{ id: string; appointmentCount: number }>>;
  /** Fetch clinic opening hours / schedule ranges */
  getScheduleRanges(tenantId: string, vetId: string, localDateStr: string): Promise<TimeRange[]>;
}

export interface ScheduleService {
  getAvailableSlots(params: GetAvailableSlotsParams): Promise<BookingSlot[]>;
  selectVet(tenantId: string, localDateStr: string): Promise<string>;
  reserveSlot(params: ReserveSlotParams): Promise<{ holdId: string }>;
}

export function createScheduleService(deps: ScheduleServiceDeps): ScheduleService;
```

## Files

| File | Change |
|------|--------|
| `apps/web/src/server/booking-core.ts` | Extend with timezone + overlap logic; rename/move to `schedule-service.ts` |
| `apps/web/src/server/routers/booking.ts` | Replace inline logic with `scheduleService.*` calls; target <400 lines |
| `apps/web/src/server/routers/vet.ts` | Remove duplicate `selectVetByFairDistribution` — import from service |

## Verification

```bash
rtk tsc
grep -n "toLocaleString\|Intl\.DateTimeFormat\|zonedToUtc" apps/web/src/server/routers/booking.ts
# should return 0 matches
wc -l apps/web/src/server/routers/booking.ts
# target: <400 lines
```

## Effort / Risk
- Effort: ~4h
- Risk: **medium** — booking is revenue-critical; run full e2e booking flow on staging before merging
- Strategy: extract service first (with existing logic), wire into router second, delete inline copies third
