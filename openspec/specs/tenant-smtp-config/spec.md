## ADDED Requirements

### Requirement: Tenant can configure custom SMTP credentials
A tenant SHALL be able to save their own SMTP host, port, username, password, sender email, and sender name via the email settings UI. The password SHALL be encrypted at rest using AES-256-GCM before storage. The password SHALL never be returned in plaintext via any API response.

#### Scenario: Tenant saves valid SMTP config
- **WHEN** tenant submits SMTP host, port, user, password, sender email, and enables the toggle
- **THEN** system encrypts the password, persists all fields to `email_settings`, and returns success

#### Scenario: Tenant updates password — empty string means keep existing
- **WHEN** tenant submits an update with an empty password field
- **THEN** system leaves the stored encrypted password unchanged

#### Scenario: Missing encryption key
- **WHEN** `SMTP_CREDENTIAL_KEY` env var is absent and tenant attempts to save SMTP config
- **THEN** system returns an error and does not persist credentials

### Requirement: Email sending resolves provider per tenant
When sending any tenant-scoped email, the system SHALL check if the tenant has `smtp_enabled = true` and valid credentials in `email_settings`. If yes, it SHALL use the tenant SMTP. Otherwise it SHALL fall back to the system SMTP from env vars.

#### Scenario: Tenant SMTP enabled with valid config
- **WHEN** an email is sent for a tenant with `smtp_enabled = true` and all SMTP fields populated
- **THEN** the email is sent via the tenant's configured SMTP server

#### Scenario: Tenant SMTP disabled
- **WHEN** an email is sent for a tenant with `smtp_enabled = false`
- **THEN** the email is sent via the system SMTP

#### Scenario: Tenant has no email_settings row
- **WHEN** an email is sent for a tenant with no `email_settings` record
- **THEN** the email is sent via the system SMTP

### Requirement: Test-send validates tenant SMTP before use
The existing `email.sendTestEmail` mutation SHALL resolve the tenant's configured SMTP provider (if enabled) and use it for the test email, so tenants can verify credentials before relying on them.

#### Scenario: Test-send with tenant SMTP enabled
- **WHEN** tenant clicks "Test-Email senden" with their SMTP config saved and enabled
- **THEN** test email is sent via tenant SMTP and success is reported

#### Scenario: Test-send with tenant SMTP disabled
- **WHEN** tenant clicks "Test-Email senden" with `smtp_enabled = false`
- **THEN** test email is sent via system SMTP (existing behavior)

#### Scenario: Test-send fails due to bad credentials
- **WHEN** tenant SMTP credentials are invalid and test-send is triggered
- **THEN** system returns a descriptive error (e.g., auth failure, connection refused) — no email is logged as sent

### Requirement: Settings API masks stored password
The `email.getSettings` procedure SHALL return SMTP password as a masked placeholder string (e.g., `"••••••••"`) when credentials are present, and `null` when no password is stored.

#### Scenario: Get settings with stored password
- **WHEN** tenant fetches their email settings and a password is stored
- **THEN** response includes `smtpPassMasked: "••••••••"` and no plaintext password field

#### Scenario: Get settings with no password stored
- **WHEN** tenant fetches their email settings and no SMTP password exists
- **THEN** response includes `smtpPassMasked: null`
