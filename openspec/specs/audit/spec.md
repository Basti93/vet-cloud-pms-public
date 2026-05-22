# Audit Logging

The audit system provides an immutable, structured record of business and security events across all tenants, supporting DSGVO/GDPR traceability, security forensics, and operational accountability.

## Requirements

### Requirement: Dual-Table Log Separation
The system SHALL maintain two distinct log tables: `audit_logs` for business and compliance events (what changed in domain data), and `system_logs` for operational, runtime, and security events (admin actions, permission violations, infrastructure incidents). The two tables MUST NOT be mixed.

#### Scenario: Patient record updated
- **WHEN** a vet updates a patient's record
- **THEN** a row is written to `audit_logs` with the appropriate `action` and `changes` envelope; no entry is written to `system_logs`

#### Scenario: System admin suspends a tenant
- **WHEN** a system admin performs a suspension via the admin app
- **THEN** a row is written to `system_logs` with `tenantId: null`; no entry is written to `audit_logs`

### Requirement: Canonical Audit Event Envelope
Every `audit_logs` entry MUST use the versioned JSONB envelope in the `changes` column containing: `schemaVersion`, `event`, `summary`, `actor` (with `clerkUserId` and `userId`), `target` (with `entityType` and `entityId`), `diff`, `metadata`, and `occurredAt`. Direct inserts that bypass `writeAuditLog()` MUST still conform to this envelope shape.

#### Scenario: Appointment created via tRPC
- **WHEN** the `appointments.create` procedure succeeds
- **THEN** `writeAuditLog()` is called and produces a row with `action: "create"`, `entityType: "appointment"`, and a `changes.event` value of `"appointment.created"`

#### Scenario: Direct API route insert
- **WHEN** an API route (without tRPC context) writes directly to `audit_logs`
- **THEN** the inserted row MUST include all required envelope fields with `schemaVersion: "1.0.0"`

### Requirement: Canonical Action Taxonomy
The `action` column in `audit_logs` SHALL only contain values from the approved taxonomy: `create`, `update`, `delete`, `export`, `access`, `config_change`, `permission_change`. Domain-specific semantics MUST be expressed in the `changes.event` field, not in the `action` column.

#### Scenario: DSGVO data export
- **WHEN** a tenant requests a data export
- **THEN** the audit row has `action: "export"` and `changes.event: "tenant.data_exported"`

#### Scenario: Non-canonical action attempted
- **WHEN** code attempts to write an `action` value outside the approved taxonomy
- **THEN** the database constraint rejects the insert

### Requirement: Data Minimization in Audit Payloads
Audit log entries MUST NOT contain secrets, tokens, passwords, or authentication headers. Full PII values MUST NOT be logged when only an identifier or field-level metadata is sufficient. Sensitive free text MUST be redacted or replaced with presence/length metadata.

#### Scenario: Password change event
- **WHEN** a user changes their password
- **THEN** the audit entry records that a password change occurred but contains no password value, hash, or token

#### Scenario: Patient note updated
- **WHEN** a clinical note is updated
- **THEN** the `diff` in the audit entry records the field names and change timestamps, not the raw medical text content

### Requirement: writeAuditLog as Standard Interface
All business-mutating tRPC procedures SHALL call `writeAuditLog()` rather than inserting directly into `audit_logs`. Direct inserts are only permitted from API routes where the tRPC context is unavailable, and MUST use the same envelope shape.

#### Scenario: New tRPC mutation added
- **WHEN** a developer adds a new write procedure to any tRPC router
- **THEN** the procedure calls `writeAuditLog()` with the canonical action and event name before returning a response

### Requirement: DSGVO Retention and Erasure Compliance
Domain table records MUST be soft-deleted (marked with `deleted_at`) rather than physically removed on normal deletion. When a full erasure is legally requested, audit log rows that contain direct personal identifiers MUST be either deleted or anonymized. Audit records may be retained only when legally required and de-identified.

#### Scenario: Soft delete of patient record
- **WHEN** a patient record is deleted through the application
- **THEN** the row is marked with `deleted_at` and excluded from all queries, while an `audit_logs` entry with `action: "delete"` is written

#### Scenario: DSGVO erasure request
- **WHEN** a verified erasure request is processed
- **THEN** personal data in domain tables is removed and audit log rows containing direct personal identifiers are deleted or anonymized; rows containing only IDs and action metadata may be retained
