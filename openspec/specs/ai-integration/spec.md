# AI Voice Reception (Vapi Integration)

The AI voice reception feature uses Vapi AI to provide a German-language voice assistant that handles inbound calls and books appointments, gated behind a per-tenant feature flag.

## Requirements

### Requirement: Feature Flag Gate
The AI reception feature SHALL be available only to tenants for whom the `aiReceptionEnabled` feature flag is active. Tenants without the flag MUST see a disabled state in the UI and the Vapi SDK MUST NOT be initialized.

#### Scenario: Tenant without AI reception enabled
- **WHEN** a user navigates to `/dashboard/voice` and `aiReceptionEnabled` is false
- **THEN** the Vapi SDK is not initialized and the UI displays a "feature not activated" message without any call controls

#### Scenario: Tenant with AI reception enabled
- **WHEN** `aiReceptionEnabled` is true and `NEXT_PUBLIC_VAPI_PUBLIC_KEY` is set
- **THEN** the Vapi SDK is initialized and the call interface is rendered

### Requirement: Webhook Signature Verification
The Vapi webhook endpoint at `/api/vapi/webhook` SHALL verify the HMAC-SHA256 signature in the `x-vapi-signature` header against `VAPI_WEBHOOK_SECRET` before processing any event. Requests with an invalid or missing signature MUST be rejected.

#### Scenario: Valid webhook event received
- **WHEN** Vapi POSTs an event with a correct `x-vapi-signature` header
- **THEN** the event is processed and the handler returns HTTP 200 with `{ "received": true }`

#### Scenario: Webhook received with invalid signature
- **WHEN** Vapi POSTs an event with an incorrect or missing `x-vapi-signature` header and `VAPI_WEBHOOK_SECRET` is set
- **THEN** the handler returns HTTP 401 without processing the event payload

### Requirement: Call Lifecycle Tracking
Inbound call metadata SHALL be persisted to the `voice_calls` table. A record is created when a call reaches `in-progress` status and updated with transcript, recording URL, duration, and summary when the `end-of-call-report` event is received.

#### Scenario: Call starts
- **WHEN** Vapi sends a `status-update` event with `status: "in-progress"`
- **THEN** a row is inserted into `voice_calls` with `vapiCallId`, `phoneNumber`, and `status: "active"`, scoped to the resolved tenant ID

#### Scenario: Call ends
- **WHEN** Vapi sends an `end-of-call-report` event for a known `vapiCallId`
- **THEN** the matching `voice_calls` row is updated with `status: "completed"`, the transcript, `recordingUrl`, `duration`, and call summary

### Requirement: AI-Driven Appointment Booking via Function Call
The webhook handler SHALL respond to Vapi `function-call` events with `functionCall.name === "bookAppointment"`. When an existing owner can be matched by phone number, the handler MUST return a confirmation response. When no match is found, it MUST return a handoff response indicating a team member will follow up.

#### Scenario: Known owner phones to book
- **WHEN** Vapi calls `bookAppointment` with a phone number that matches an existing owner
- **THEN** the handler looks up the owner's patient and returns `{ "result": "Termin für <name> eingetragen. Bestätigungsnummer: <id>." }`

#### Scenario: Unknown caller phones to book
- **WHEN** Vapi calls `bookAppointment` with a phone number that does not match any owner
- **THEN** the handler returns `{ "result": "Ich habe die Anfrage aufgenommen. Jemand aus dem Team wird sich melden, um den Termin zu bestätigen." }` without inserting any record

### Requirement: Live Transcript Display
The voice UI SHALL stream real-time transcript entries during an active call, distinguishing between partial (in-progress) and final (confirmed) utterances. Partial entries MUST be replaced in-place when the final transcript for the same turn arrives.

#### Scenario: Partial transcript received
- **WHEN** Vapi emits a `transcript` message with `transcriptType: "partial"`
- **THEN** the UI either updates an existing partial entry for the same speaker role or appends a new one, displayed with a trailing ellipsis

#### Scenario: Final transcript received
- **WHEN** Vapi emits a `transcript` message with `transcriptType: "final"`
- **THEN** all partial entries for that speaker turn are removed and replaced with the final text entry

### Requirement: Webhook Liveness Probe
The Vapi webhook endpoint SHALL respond to GET requests with HTTP 200 and a JSON health payload, allowing Vapi to verify the endpoint is reachable during configuration.

#### Scenario: Vapi pings the webhook
- **WHEN** Vapi sends a GET request to `/api/vapi/webhook`
- **THEN** the endpoint returns HTTP 200 with `{ "status": "ok", "service": "vet-cloud-pms-vapi-webhook" }`
