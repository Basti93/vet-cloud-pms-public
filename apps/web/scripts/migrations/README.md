# Database Migrations

This directory contains one-off database migration scripts for Vet Cloud PMS. Use these for custom data transformations, backfills, and schema adjustments that go beyond Drizzle's auto-migration capabilities.

## Quick Start

### 1. Create a new migration script

Copy the template and name it descriptively:

```bash
cp scripts/migrations/example-migration.ts scripts/migrations/add-billing-fields.ts
```

Edit the script:

```typescript
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '@/lib/db/schema';

const dryRun = process.env.DRY_RUN === 'true';

async function main() {
  const client = postgres(process.env.DATABASE_URL!);
  const db = drizzle(client, { schema });

  try {
    // Your migration logic here
    const result = await db.update(schema.appointments)
      .set({ billingCode: 'V01' })
      .where(/* conditions */)
      .execute();

    console.log(`✅ Updated ${result.rowCount} appointments`);

    if (dryRun) {
      console.log('⚠️  DRY RUN - No changes applied');
    }
  } finally {
    await client.end();
  }
}

main();
```

### 2. Run locally (optional)

Test on your local machine first:

```bash
# With staging database
DATABASE_URL="postgres://..." npx tsx scripts/migrations/add-billing-fields.ts

# Dry run (if your script supports it)
DRY_RUN=true DATABASE_URL="postgres://..." npx tsx scripts/migrations/add-billing-fields.ts
```

### 3. Run via GitHub Actions

**Go to:** [`Actions` → `Run Database Script`](https://github.com/yourusername/vet-cloud-pms/actions/workflows/run-database-script.yml)

**Fill in:**
- **Script name:** `add-billing-fields` (without `.ts` extension)
- **Environment:** `staging` or `production`
- **Dry run:** Check this to preview changes without applying them

**Click:** `Run workflow`

### 4. Monitor the run

The workflow will:
1. ✅ Validate the script exists
2. 📋 Display migration details
3. 🔄 Run the script
4. 📝 Log the migration to `.migration-log.jsonl` (audit trail)
5. 📢 Notify on success/failure

## Best Practices

### Always include a dry-run mode

```typescript
const dryRun = process.env.DRY_RUN === 'true';

// ... later in your script
if (dryRun) {
  console.log('⚠️  DRY RUN - No changes applied');
} else {
  // Actually execute the migration
}
```

### Count affected rows

```typescript
const result = await db.query.patients.findMany({ where: /* ... */ });
console.log(`✅ Processed ${result.length} patients`);
```

### Test on staging first

Always run migrations on staging before production:
1. Run on `staging` environment
2. Verify the data looks correct
3. Then run on `production`

### Add error handling

```typescript
try {
  // migration logic
} catch (error) {
  console.error('❌ Migration failed:', error);
  throw error; // Re-throw so GitHub Actions sees the failure
} finally {
  await client.end(); // Always close the connection
}
```

### Log meaningful output

```typescript
console.log(`📋 Migration: add-billing-fields`);
console.log(`   Timestamp: ${new Date().toISOString()}`);
console.log(`   Records before: ${beforeCount}`);
console.log(`   Records updated: ${updateCount}`);
console.log(`   Records after: ${afterCount}`);
```

## Examples

### Example 1: Add a field to existing records

```typescript
const result = await db.update(schema.appointments)
  .set({ reminderSentAt: null })
  .where(isNull(schema.appointments.reminderSentAt))
  .execute();

console.log(`✅ Reset ${result.rowCount} appointment reminders`);
```

### Example 2: Backfill computed data

```typescript
const patients = await db.query.patients.findMany();

for (const patient of patients) {
  const appointments = await db.query.appointments.findMany({
    where: eq(schema.appointments.patientId, patient.id),
  });

  await db.update(schema.patients)
    .set({ appointmentCount: appointments.length })
    .where(eq(schema.patients.id, patient.id))
    .execute();
}

console.log(`✅ Updated appointment counts for ${patients.length} patients`);
```

### Example 3: Migrate data between tables

```typescript
const oldRecords = await db.query.legacyPatients.findMany();

for (const old of oldRecords) {
  const newRecord = await db.insert(schema.patients)
    .values({
      name: old.name,
      species: old.species,
      tenantId: old.tenantId,
    })
    .returning();

  console.log(`✅ Migrated patient: ${newRecord[0].name}`);
}

console.log(`✅ Total migrated: ${oldRecords.length}`);
```

## Migration Naming Convention

Use clear, descriptive names:

- `add-billing-fields.ts` — Add new columns
- `backfill-patient-ids.ts` — Populate existing column
- `migrate-legacy-owners.ts` — Data migration from old table
- `fix-duplicate-appointments.ts` — Data cleanup
- `reset-demo-tenant.ts` — Demo data reset

**Avoid:** `migration-1.ts`, `fix-bug.ts`, `temp-script.ts`

## Audit Trail

Every migration is logged to `.migration-log.jsonl`:

```jsonl
{"timestamp": "2026-04-29T10:30:00Z", "script": "add-billing-fields", "environment": "production", "author": "maintainer", "commit": "abc123def456", "status": "success"}
```

View the audit trail:

```bash
cat .migration-log.jsonl | jq .
```

## Rollback Strategy

If a migration goes wrong:

1. **Identify the issue** — Check GitHub Actions logs
2. **Write a rollback script** — Create `undo-add-billing-fields.ts`
3. **Test on staging** — Verify the rollback works
4. **Run in production** — Use GitHub Actions workflow
5. **Verify** — Query the database to confirm

Example rollback:

```typescript
// undo-add-billing-fields.ts
const result = await db.update(schema.appointments)
  .set({ billingCode: null })
  .execute();

console.log(`✅ Rolled back ${result.rowCount} appointments`);
```

## Environment Variables

Migrations use the `DATABASE_URL` secret from your GitHub environment:

- **Staging:** Uses `DATABASE_URL` from "staging" environment
- **Production:** Uses `DATABASE_URL` from "production" environment

To add a new environment:
1. Go to Settings → Environments
2. Create new environment (e.g., "staging")
3. Add `DATABASE_URL` secret

## Troubleshooting

### Script not found

```
❌ Script not found at: apps/web/scripts/migrations/my-migration.ts
```

**Fix:** Make sure the script file exists with the correct name (no `.ts` extension in the workflow input).

### Database connection failed

```
Error: connect ENOTFOUND [database-host]
```

**Fix:** Verify the `DATABASE_URL` secret is set correctly in the GitHub environment.

### Timeout

If the migration takes >10 minutes, increase the timeout in the workflow file.

### Permission denied

If you get permission errors, check that:
- The script has proper error handling
- The database user has the necessary permissions
- Tables exist and aren't locked

## Questions?

Refer to:
- [Drizzle ORM Docs](https://orm.drizzle.team)
- [GitHub Actions Docs](https://docs.github.com/en/actions)
- `.migration-log.jsonl` for audit trail
