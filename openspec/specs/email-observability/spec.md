## ADDED Requirements

### Requirement: All service.ts email sends are logged to email_logs
Every call to a `sendXxx()` function in `service.ts` SHALL insert a row into `email_logs` with status `sent` on success or `failed` on error. The insert SHALL NOT throw — email delivery takes priority over logging.

#### Scenario: Successful send logged
- **WHEN** `sendConfirmationEmail()` delivers successfully
- **THEN** a row with `status = 'sent'`, correct `email_type`, `recipient_email`, and `tenant_id` is inserted into `email_logs`

#### Scenario: Failed send logged
- **WHEN** `sendInvitationEmail()` throws (SMTP error)
- **THEN** a row with `status = 'failed'` and `error_message` containing the error text is inserted into `email_logs`

#### Scenario: Log failure does not block email
- **WHEN** the `email_logs` insert fails (DB unavailable)
- **THEN** the error is logged to console only; the send result is returned normally to the caller

### Requirement: email_logs table stores all email metadata
The `email_logs` table SHALL have columns: `id`, `tenant_id` (nullable for system emails), `email_type` (enum of all types), `recipient_email`, `status` (`sent` | `failed`), `error_message` (nullable), `message_id` (nullable), `sent_at`.

#### Scenario: System email with no tenant
- **WHEN** a system email without a tenant context is called (no tenant context)
- **THEN** row is inserted with `tenant_id = null`

#### Scenario: Tenant email linked to tenant
- **WHEN** `sendConfirmationEmail()` is called with a tenantId
- **THEN** row has non-null `tenant_id` matching the calling tenant

### Requirement: Admin unified email log view
The admin dashboard SHALL have a page at `/dashboard/emails` showing all email log entries across all tenants, filterable by `email_type`, `tenant`, `status`, and date range.

#### Scenario: Filter by failed status
- **WHEN** admin selects status = failed
- **THEN** only rows with `status = 'failed'` are shown, including `error_message`

#### Scenario: Filter by tenant
- **WHEN** admin selects a specific tenant
- **THEN** only that tenant's email logs are shown

### Requirement: Admin nav shows failure badge
If any `email_logs` rows have `status = 'failed'` in the last 24 hours, the admin nav SHALL display a badge on the email menu item.

#### Scenario: No recent failures
- **WHEN** no failed emails exist in last 24h
- **THEN** no badge is shown

#### Scenario: Recent failures exist
- **WHEN** one or more failed rows exist in last 24h
- **THEN** badge shows the failure count

### Requirement: Tenant statistics show true email delivery rate
The tenant statistics page SHALL display `emailDeliveryRate` computed from `email_logs` filtered by `tenant_id`, replacing the current `appointment_email_logs`-only query.

#### Scenario: Mixed email types included in rate
- **WHEN** a tenant has sent 10 emails (8 sent, 2 failed) across confirmations and invitations
- **THEN** delivery rate shows 80%

#### Scenario: No emails sent
- **WHEN** tenant has no email_logs rows in the selected period
- **THEN** delivery rate shows 0% or "Keine Daten"
