# schedule-service Specification

## Purpose
TBD - created by archiving change implementation-cleanup-slices. Update Purpose after archive.
## Requirements
### Requirement: Scheduling domain logic lives behind a service interface
Logic that computes booking slots, filters availability, reserves slot holds, or assigns vets SHALL live behind a `ScheduleService` module.

#### Scenario: Available slots query
- **WHEN** `ScheduleService.getAvailableSlots()` is called with tenant, optional vet, and date parameters
- **THEN** it returns slots filtered for past times, booked appointments, and active holds
- **AND** timezone conversion happens inside scheduling code rather than in the router handler

#### Scenario: Slot reservation
- **WHEN** `ScheduleService.reserveSlot()` is called for an available slot
- **THEN** it removes the browser session's older holds
- **AND** it creates a new hold with an expiry timestamp

#### Scenario: Vet assignment
- **WHEN** `ScheduleService.selectVet()` is called
- **THEN** it returns the active vet with the fewest matching scheduled appointments
- **AND** it throws if no vets are available

#### Scenario: Booking router is thin
- **WHEN** `apps/web/src/server/routers/booking.ts` is inspected
- **THEN** scheduling calculations, hold conflict detection, and fair-distribution logic are delegated to `ScheduleService`
- **AND** the file contains no local timezone conversion or slot overlap logic

### Requirement: ScheduleService is testable without tRPC context
The scheduling service SHALL accept explicit parameters and a database dependency rather than tRPC context types.

#### Scenario: Service construction
- **WHEN** scheduling logic is used from a router
- **THEN** the router constructs or obtains a `ScheduleService` with database dependencies
- **AND** calls service methods with plain parameter objects

