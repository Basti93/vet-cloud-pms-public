## ADDED Requirements

### Requirement: Selector Priority Order
E2E tests SHALL use selectors in strict priority order: (1) `getByTestId`, (2) `getByRole` with name, (3) `locator('[name="..."]')` for Clerk-owned fields only, (4) `locator('[data-localization-key="..."]')` for Clerk buttons only. Tests MUST NOT use `getByText` with German copy, `getByPlaceholder` with German copy, or CSS class selectors.

#### Scenario: New test targets a custom modal
- **WHEN** a developer writes a test that asserts a modal is open
- **THEN** the test uses `getByRole("heading", { name: "..." })` or `getByTestId("...-modal")`, never `getByRole("dialog")` (custom `<Modal>` is a `<div>`)

#### Scenario: New test targets a search result in a combobox
- **WHEN** a developer writes a test that clicks a combobox option
- **THEN** the option element has `data-testid="[combobox-name]-option-[value]"` and the test uses `getByTestId`, preceded by an explicit `toBeVisible` wait

#### Scenario: Clerk-owned field selector exemption
- **WHEN** a test interacts with Clerk's sign-in or sign-up form
- **THEN** the test uses `locator('input[name="emailAddress"]')` or `locator('[data-localization-key="formButtonPrimary"]')` — these are stable Clerk API surface, not German copy

### Requirement: Required data-testid Per UI Pattern
Every shared UI component pattern SHALL expose `data-testid` on its primary interactive or assertable element. The following patterns have mandatory testid coverage:

| Pattern | Required testid | Element |
|---------|----------------|---------|
| `<Modal>` | `[name]-modal` | Modal panel `<div>` |
| Combobox input | `[feature]-[field]-input` | `<input>` |
| Combobox option | `[feature]-[field]-option` | Option `<li>` or `<button>` |
| Toast / success notification | `toast-success` / `toast-error` | Notification root |
| List row | `[entity]-row` | Row container |
| Form submit button | `[feature]-submit` | `<button type="submit">` |
| Page root | `[page-name]-page` | Top-level page `<div>` |

#### Scenario: Developer adds new modal
- **WHEN** a developer creates a new component that uses `<Modal>`
- **THEN** they pass a `testId` prop (e.g., `testId="new-vet-modal"`) and the modal panel renders `data-testid="new-vet-modal"`

#### Scenario: Combobox search result targeted in test
- **WHEN** a test selects a patient from the appointment form combobox
- **THEN** it uses `getByTestId("appointment-patient-option")` after an explicit `toBeVisible` wait, not `getByText("Bella (Hund")`

#### Scenario: Toast assertion
- **WHEN** a test verifies a save action succeeded
- **THEN** it uses `getByTestId("toast-success")`, not `getByText("Gespeichert")`

### Requirement: Timeout Tiers
Every E2E test SHALL declare an appropriate timeout tier using `test.setTimeout()`. Tests MUST NOT rely on the 30s default when the interaction involves async server calls.

| Tier | Use case | `test.setTimeout` | `toBeVisible` timeout |
|------|----------|--------------------|-----------------------|
| Simple | Navigation + static assertion only | 30s (default, omit call) | 5s |
| Standard | Single async interaction (search, form submit, modal open) | 60s | 10s |
| Complex | Multi-step flow (create → navigate → assert) | 90s | 10–15s |
| Auth flow | Clerk sign-up, invitation, email verification | 120s | 20s |

`waitForResponse` on tRPC mutations SHALL use a minimum timeout of 30s to accommodate cold-server Clerk API latency.

#### Scenario: Simple navigation test
- **WHEN** a test only navigates to a page and asserts a static element is visible
- **THEN** no `test.setTimeout` call is needed; the 30s default applies

#### Scenario: Appointment creation test
- **WHEN** a test creates an appointment (involves search dropdown, form submit, page navigation)
- **THEN** the test sets `test.setTimeout(90_000)` at the start

#### Scenario: Invitation flow test
- **WHEN** a test sends an invitation and the invited user completes sign-up with email verification
- **THEN** the test sets `test.setTimeout(120_000)` and `waitForResponse` uses `timeout: 30_000` minimum

### Requirement: Explicit Visibility Wait Before Click on Dynamic Elements
Any element that appears as a result of a user interaction (combobox dropdown options, modal content, success messages) SHALL have an explicit `await expect(locator).toBeVisible({ timeout: N })` call before `.click()` or `.fill()`. Relying on Playwright's implicit action timeout for dynamic elements is prohibited.

#### Scenario: Combobox option click
- **WHEN** a test fills a search input and then clicks a result
- **THEN** the code pattern is:
  ```ts
  await input.fill("Bella");
  const option = page.getByTestId("appointment-patient-option");
  await expect(option).toBeVisible({ timeout: 10_000 });
  await option.click();
  ```

#### Scenario: Modal assertion after button click
- **WHEN** a test clicks a button that opens a modal
- **THEN** the first assertion after the click uses `toBeVisible({ timeout: 10_000 })` on a testid inside the modal, not a 0-timeout count or implicit wait

### Requirement: Cold-Server Timing Allowances
E2E tests run immediately after a fresh deploy. Tests SHALL account for cold-server latency: availability API, search endpoints, and Clerk webhooks are all slower on first call.

#### Scenario: Slot availability not loading
- **WHEN** a test iterates booking date slots and none appear within the per-day wait
- **THEN** the per-day `waitFor` timeout is at least 8s (not 2–3s) to allow cold server to respond

#### Scenario: tRPC mutation slow on cold server
- **WHEN** a test waits for a `POST /api/trpc/...` response
- **THEN** `page.waitForResponse` timeout is at least 30s, not the default or a lower value

### Requirement: No German Copy in Selectors
Selectors SHALL NOT include German-language strings as the primary matching criterion. This applies to `getByText`, `getByPlaceholder`, `getByLabel`, and CSS attribute selectors that match translated content.

#### Scenario: Success message assertion
- **WHEN** a test verifies an action succeeded
- **THEN** it uses `getByTestId("toast-success")` or `getByTestId("save-confirmation")`, not `getByText("Gespeichert")` or `getByText("Erfolgreich")`

#### Scenario: Form placeholder used as selector
- **WHEN** a test targets an input field
- **THEN** the input has a `data-testid` attribute and the test uses `getByTestId(...)`, not `getByPlaceholder("Nach Tier oder Tierbesitzer suchen…")`
