# Testing Strategy

Vet Cloud PMS uses a four-layer testing approach — TypeScript types, Vitest unit tests, Vitest integration tests against real Postgres, and Playwright E2E against the staging environment — with no mocking of the database layer and no snapshot tests.

## Requirements

### Requirement: Test Selector Language-Safety
Tests MUST NOT use German-language strings as selectors. Selectors SHALL follow strict priority order defined in `openspec/specs/e2e-conventions/spec.md`: (1) `data-testid`, (2) ARIA role with name, (3) `[name=]` for Clerk-owned fields, (4) `[data-localization-key=]` for Clerk buttons. `getByText` with translated copy, `getByPlaceholder` with translated copy, and CSS class selectors are prohibited. Clerk-owned UI (sign-in, sign-up, email verification) is exempt from `data-testid` requirements as those components are not authored by this project.

#### Scenario: Booking form selector
- **WHEN** a Playwright test targets the booking submit button
- **THEN** the selector is `page.getByTestId('booking-confirm-submit')`, not `page.getByText('Termin buchen')`

#### Scenario: CSS class selector prohibited
- **WHEN** a developer writes a new Playwright test
- **THEN** selectors using `.some-class > span` patterns are rejected in code review — only `data-testid`, `getByRole`, and Clerk-specific attribute selectors are permitted

#### Scenario: Clerk sign-up field exception
- **WHEN** a test must fill Clerk's sign-up form
- **THEN** the test uses `locator('input[name="emailAddress"]')` — this is the documented Clerk field name, not German copy

#### Scenario: Success toast selector
- **WHEN** a test verifies a save action succeeded
- **THEN** the test uses `getByTestId("toast-success")` not `getByText("Gespeichert")`

### Requirement: data-testid Attribute Convention
Every new interactive element added to the UI SHALL include a `data-testid` attribute in the same PR as the feature code. The attribute MUST follow the `[feature]-[element]` naming pattern. Shared UI components (`Modal`, combobox, toast) SHALL accept a `testId` prop and stamp it on the root interactive element. Option items in comboboxes SHALL render `data-testid="[feature]-[field]-option"`.

#### Scenario: New button added
- **WHEN** a developer adds a new interactive button or input to the UI
- **THEN** the element has a `data-testid` attribute following the pattern (e.g. `patient-create-btn`, `appointment-save-btn`) in the same commit

#### Scenario: Modal component used in REDACTEDed flow
- **WHEN** a developer uses `<Modal>` in a page that has or will have E2E coverage
- **THEN** they pass `testId="[name]-modal"` to the Modal component so tests can assert on `getByTestId("[name]-modal")` instead of text content

#### Scenario: Combobox option items
- **WHEN** a combobox renders search results that a test must click
- **THEN** each option element has `data-testid="[feature]-[field]-option"` so tests can use `getByTestId` instead of `getByText`

### Requirement: Unit Tests Cover Pure Logic Only
Vitest unit tests SHALL target pure functions with non-trivial logic. Unit tests MUST NOT mock or instantiate a database, network connection, or React component. tRPC procedure handlers and functions that only call the database SHALL NOT have unit tests.

#### Scenario: Date window calculation tested
- **WHEN** a new date-based calculation function is written (e.g. vaccination expiry window, reminder offset)
- **THEN** a unit test covering the boundary conditions is added to `apps/web/src/lib/**/__tests__/*.test.ts`

#### Scenario: tRPC procedure not unit-tested
- **WHEN** a developer adds a new tRPC procedure
- **THEN** no unit test is created for the procedure handler — TypeScript covers the shape and integration tests cover behavior

### Requirement: Integration Tests Use Real Postgres
Integration tests SHALL run against a real Postgres instance (via Docker) with actual Drizzle migrations applied. Mocking the database in integration tests is not permitted. Integration tests MUST cover tenant isolation, auth enforcement, and permission checks.

#### Scenario: Tenant isolation verified
- **WHEN** an integration test calls `patient.list` as tenant A
- **THEN** only rows belonging to tenant A are returned — no rows from tenant B appear

#### Scenario: Unauthenticated request rejected
- **WHEN** an integration test calls a `protectedProcedure` without a valid session
- **THEN** the procedure returns a `401 UNAUTHORIZED` error

#### Scenario: Role-based access enforced
- **WHEN** an integration test calls an admin-only procedure with a TFA-role user
- **THEN** the procedure returns `FORBIDDEN`

### Requirement: E2E Tests Run Against Staging
Playwright E2E tests SHALL run against `https://staging.example.com` — no local server, no mocked network, real database. Tests MUST use the dedicated `e2e` tenant with credentials from GitHub secrets (`E2E_EMAIL`, `E2E_PASSWORD`).

#### Scenario: E2E run on staging deployment
- **WHEN** a commit is pushed to `staging` after the deploy completes
- **THEN** the deploy workflow resets the e2e tenant, runs the full Playwright suite against staging, and uploads the report on failure

#### Scenario: E2E tenant reset
- **WHEN** the pre-E2E reset runs
- **THEN** `POST /api/cron/reset-e2e-tenant` wipes transient data, creates two active e2e vets, seeds 09:00-17:00 schedules, disables outbound emails, and returns the preview token

### Requirement: E2E Tests Cover Eight Critical Paths
The eight canonical E2E tests SHALL be maintained and kept passing: booking flow (unauthenticated), booking management views, login and dashboard load, patient CRUD, calendar and appointment creation, patient appointment history, settings page smoke, and admin UI tenant list.

#### Scenario: Booking flow test
- **WHEN** the E2E suite runs
- **THEN** test 1 loads `/book/REDACTED?preview=...`, completes the multi-step booking form using `data-testid` selectors, and reaches the `booking-success` state

#### Scenario: Admin UI smoke test
- **WHEN** the E2E suite runs
- **THEN** test 8 authenticates at `apps.example.com` and verifies the tenant list is visible

### Requirement: New Feature Testing Checklist
Every new feature SHALL satisfy all applicable checklist items before merging: TypeScript types compile, a unit test exists if the feature contains non-trivial pure logic, an integration test exists if the feature touches `tenant_id` or auth, `data-testid` attributes are added to new interactive elements, E2E tests are updated if a critical user path changed, and a manual smoke test on staging is done before merging to `main`.

#### Scenario: Feature with tenant-scoped logic
- **WHEN** a developer ships a new feature that queries or writes tenant-scoped data
- **THEN** an integration test covering tenant isolation for that feature is present before the PR is merged

### Requirement: E2E Tests Declare Explicit Timeout Tiers
Every Playwright test SHALL declare `test.setTimeout(N)` matching the complexity tier defined in `openspec/specs/e2e-conventions/spec.md`. Tests with a single async interaction use 60s, multi-step flows use 90s, and auth flows (Clerk sign-up/invitation) use 120s. The 30s default is reserved for navigation-only tests.

#### Scenario: Multi-step test without timeout declaration
- **WHEN** a code review sees a test that creates a record, navigates, and asserts — but has no `test.setTimeout` call
- **THEN** the reviewer requests `test.setTimeout(90_000)` be added before merge

#### Scenario: waitForResponse on tRPC mutation
- **WHEN** a test uses `page.waitForResponse` to intercept a tRPC POST
- **THEN** the timeout argument is at least 30_000 to handle cold-server Clerk latency

### Requirement: Deliberate Test Exclusions
Snapshot tests, 100% coverage targets, database mocking in integration tests, E2E tests for edge/error cases, visual regression tests, and load/performance tests SHALL NOT be added. Edge cases belong in integration tests; visual testing is not done at current scale.

#### Scenario: Snapshot test proposed
- **WHEN** a developer proposes adding React component snapshot tests
- **THEN** the PR is rejected — snapshot tests are explicitly out of scope and break on every UI change
