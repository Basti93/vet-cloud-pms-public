# Database Migrations

Data migration scripts for Vet Cloud PMS run as TypeScript files in `apps/web/scripts/migrations/`, executed locally or via the GitHub Actions `Run Database Script` workflow, with a mandatory dry-run step before any destructive change.

## Requirements

### Requirement: Migration Scripts Are Idempotent
Every migration script MUST be safe to run multiple times without producing duplicate data or errors. Scripts MUST check for existing state before inserting or updating records.

#### Scenario: Re-running completed migration
- **WHEN** a migration script that has already been applied is run again
- **THEN** no duplicate rows are created and the script exits cleanly

### Requirement: Dry-Run Mode
Every migration script SHALL support a `DRY_RUN=true` environment variable that logs intended changes without applying them. Destructive or complex migrations MUST be tested with `DRY_RUN=true` before an actual run.

#### Scenario: Dry run before destructive update
- **WHEN** a developer runs `DRY_RUN=true npx tsx scripts/migrations/my-migration.ts`
- **THEN** the script logs what it would change and exits without modifying any data

### Requirement: Database Connection Cleanup
Migration scripts MUST close the database connection in a `finally` block, regardless of whether the migration succeeds or fails.

#### Scenario: Script fails mid-migration
- **WHEN** a migration script throws an error partway through
- **THEN** the `finally` block calls `client.end()` and the Postgres connection is released before the process exits

### Requirement: Migration Audit Trail
Every migration run SHALL be recorded in `.migration-log.jsonl` with timestamp, script name, environment, author, commit hash, and status. This file MUST NOT be deleted or truncated.

#### Scenario: Successful production migration
- **WHEN** a migration completes successfully on production via GitHub Actions
- **THEN** a JSON line is appended to `.migration-log.jsonl` with `status: "success"` and the GitHub Actions bot as author

### Requirement: Staging-First Execution Order
Migrations MUST be tested on the `staging` environment before running on `production`. Running a migration directly on production without a prior staging run is not permitted.

#### Scenario: New migration workflow
- **WHEN** a developer needs to run a new migration on production
- **THEN** the migration is first run on staging via the GitHub Actions workflow, verified, and only then triggered on production

### Requirement: Migration Scripts Must Handle Errors Gracefully
Scripts MUST wrap database operations in try/catch, log meaningful error messages including row counts and failure reasons, and exit with a non-zero status on failure so GitHub Actions marks the run as failed.

#### Scenario: Migration encounters constraint violation
- **WHEN** a migration script encounters a database constraint error
- **THEN** the error is caught, logged with the affected record identifier, and the process exits non-zero

### Requirement: No Seeds in Production
The `db:seed` command and seed scripts MUST NOT be run against production or staging databases. Seed data is exclusively for local development.

#### Scenario: Accidental production seed attempt
- **WHEN** a developer attempts to run seed scripts against the production `DATABASE_URL`
- **THEN** the operation is blocked or the developer is expected to abort — seed scripts are not run via the migration workflow

### Requirement: Rollback Scripts for Reversible Migrations
For any migration that modifies existing data in a reversible way, a corresponding rollback script SHALL be created in `apps/web/scripts/migrations/` and tested locally before the forward migration runs on production.

#### Scenario: Migration needs reverting
- **WHEN** a production migration causes unexpected behavior
- **THEN** the rollback script is available, tested on staging, and run via GitHub Actions to restore prior state
