# user-feedback Specification

## Purpose

Defines how authenticated clinic users submit product feedback from dashboard workflows and how system admins review that feedback.

## Requirements
### Requirement: Authenticated Feedback Submission
Authenticated clinic users SHALL be able to submit product feedback from the dashboard without manually entering tenant or user identity.

#### Scenario: User submits feedback from a dashboard page
- **WHEN** an authenticated tenant user submits feedback with a message from a dashboard page
- **THEN** the system stores the feedback with the user's tenant ID, user ID, source path, source module, message, status `new`, and creation timestamp
- **AND** the system writes a tenant audit log entry for the created feedback
- **AND** the system sends a best-effort notification email to configured system admins

#### Scenario: User submits empty feedback
- **WHEN** an authenticated tenant user submits feedback with an empty or whitespace-only message
- **THEN** the system rejects the submission with a validation error and does not create a feedback row

#### Scenario: Client attempts to spoof tenant identity
- **WHEN** a feedback submission includes a tenant ID or user ID in the client payload
- **THEN** the system ignores those fields and uses the authenticated request context for persisted tenant and user ownership

#### Scenario: Admin notification cannot be delivered
- **WHEN** feedback is stored but the system cannot resolve or email a configured system admin
- **THEN** the feedback submission still succeeds
- **AND** the system logs the notification failure to `system_logs`

### Requirement: Dashboard Feedback Entry Point
The authenticated dashboard SHALL provide a persistent feedback entry point in the sidebar so users can submit feedback from any dashboard route.

#### Scenario: User opens feedback from sidebar
- **WHEN** an authenticated tenant user selects the sidebar feedback action
- **THEN** the system opens a feedback form without navigating away from the current dashboard page

#### Scenario: Feedback captures current location
- **WHEN** an authenticated tenant user submits feedback through the sidebar form
- **THEN** the system includes the current dashboard path and inferred module key in the submission context

### Requirement: Module Testing Prompts
Dashboard modules marked as testing SHALL show a compact prompt that invites users to use the module and submit feedback.

#### Scenario: User views a testing module
- **WHEN** an authenticated tenant user opens a dashboard module marked as testing
- **THEN** the page displays a concise "Modul im Test" prompt with a feedback action for that module

#### Scenario: User starts feedback from testing prompt
- **WHEN** an authenticated tenant user selects the feedback action from a module testing prompt
- **THEN** the feedback form opens with the source module set to that module

#### Scenario: User views booking flow
- **WHEN** any user opens a public booking route or an authenticated booking-oriented dashboard route
- **THEN** the system does not display a module testing prompt

### Requirement: Feedback Submission Privacy
Feedback submission UI SHALL discourage users from including unnecessary personal, owner, patient, or medical details.

#### Scenario: User opens feedback form
- **WHEN** an authenticated tenant user opens the feedback form
- **THEN** the form displays short helper text asking the user to avoid unnecessary personal or medical details

### Requirement: Tenant-Isolated Feedback Access
Clinic-side feedback procedures SHALL preserve tenant isolation.

#### Scenario: Tenant user submits feedback
- **WHEN** a tenant user submits feedback
- **THEN** the created row is associated only with that tenant and cannot be submitted on behalf of another tenant

#### Scenario: Tenant user requests admin feedback data
- **WHEN** a tenant user who is not a system admin attempts to call internal feedback listing or update procedures
- **THEN** the system rejects the request with `FORBIDDEN`
