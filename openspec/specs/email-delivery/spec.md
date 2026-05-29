## ADDED Requirements

### Requirement: SMTP provider sends email via nodemailer
The system SHALL send all outgoing email through nodemailer using SMTP credentials configured via environment variables. The SMTP connection SHALL use STARTTLS on port 587 with `requireTLS: true`.

#### Scenario: Successful email send
- **WHEN** `provider.send()` is called with valid `to`, `subject`, and `html` or `text`
- **THEN** nodemailer delivers the message via configured SMTP server and returns `{ messageId: string }`

#### Scenario: Missing SMTP env vars at startup
- **WHEN** `SMTP_HOST`, `SMTP_USER`, or `SMTP_PASS` is absent
- **THEN** provider factory throws with a descriptive error before any send attempt

#### Scenario: SMTP auth failure
- **WHEN** SMTP server rejects credentials
- **THEN** `provider.send()` throws, error propagates to caller unchanged

### Requirement: Email provider selected via environment variable
The system SHALL instantiate the correct provider based on `EMAIL_PROVIDER` env var. Valid values: `smtp`, `resend` (legacy, for rollback only).

#### Scenario: SMTP provider selected
- **WHEN** `EMAIL_PROVIDER=smtp` (or env var is absent and default is `smtp`)
- **THEN** `getEmailProvider()` returns an `SmtpProvider` instance

#### Scenario: Unknown provider value
- **WHEN** `EMAIL_PROVIDER` is set to an unrecognized value
- **THEN** `getEmailProvider()` throws `Error: Unknown email provider: <value>`

### Requirement: service.ts uses provider abstraction
All send functions in `service.ts` SHALL use `getEmailProvider().send()` instead of calling the Resend SDK directly.

#### Scenario: Confirmation email sent
- **WHEN** `sendConfirmationEmail()` is called
- **THEN** it delegates to `getEmailProvider().send()` with correct `from`, `to`, `subject`, `text`

#### Scenario: No direct Resend import in service.ts
- **WHEN** codebase is built
- **THEN** `service.ts` has no import from `'resend'`

### Requirement: Sender address conventions
The system SHALL use `noreply@example.com` as the `from` address on all outbound emails. Email body text referencing support contact SHALL use `info@example.com`.

#### Scenario: System sender format
- **WHEN** `systemSender()` is called
- **THEN** returns `"VetCloud <noreply@example.com>"`

#### Scenario: Tenant sender format
- **WHEN** `tenantSender("Tierarztpraxis Müller")` is called
- **THEN** returns `"Tierarztpraxis Müller <noreply@example.com>"`

### Requirement: Mailpit catch-all for local development
Mailpit SHALL be available as a Docker Compose service for local development. When `SMTP_HOST=localhost` and `SMTP_PORT=1025`, all outgoing emails SHALL be caught by Mailpit and visible in the web UI at `localhost:8025`. No email SHALL reach real inboxes during local development.

#### Scenario: Email caught by Mailpit
- **WHEN** any send function is called during local dev with Mailpit running
- **THEN** email appears in Mailpit web UI at `localhost:8025` within seconds

#### Scenario: docker-compose includes Mailpit
- **WHEN** `docker compose up -d` is run
- **THEN** Mailpit container starts on ports 1025 (SMTP) and 8025 (HTTP)

#### Scenario: No auth required for local SMTP
- **WHEN** SMTP credentials are dummy values (`user=test`, `pass=test`)
- **THEN** Mailpit accepts the connection and delivers to its inbox

### Requirement: resend package removed
The `resend` npm package SHALL be removed from dependencies after migration. No file in `apps/web/src` SHALL import from `'resend'`.

#### Scenario: Clean dependency tree
- **WHEN** `npm ls resend` is run after migration
- **THEN** package is not listed as a direct dependency
