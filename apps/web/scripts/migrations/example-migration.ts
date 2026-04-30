/**
 * Example migration script template
 *
 * Usage:
 *   npx ts-node scripts/migrations/example-migration.ts
 *
 * Or via GitHub Actions:
 *   1. Go to Actions > "Run Database Script"
 *   2. Click "Run workflow"
 *   3. Enter "example-migration" as the script name
 *   4. Choose environment (staging or production)
 *   5. Optional: check "dry_run" to preview changes
 *
 * Tips:
 *   - Always include a count of affected rows
 *   - Test on staging first
 *   - Include a dry-run mode for verification
 *   - Log the migration for audit purposes
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '@/lib/db/schema';

const dryRun = process.env.DRY_RUN === 'true';

async function main() {
  console.log(`🚀 Starting migration: example-migration`);
  console.log(`   Timestamp: ${new Date().toISOString()}`);
  console.log(`   Dry Run: ${dryRun}`);
  console.log('');

  // Create database connection
  const client = postgres(process.env.DATABASE_URL!);
  const db = drizzle(client, { schema });

  try {
    // Example: Add a new field to appointments
    // const result = await db.update(schema.appointments)
    //   .set({ updatedAt: new Date() })
    //   .execute();

    // For now, just verify connection
    const count = await db.query.appointments.findMany({ limit: 1 });
    console.log(`✅ Database connection verified`);
    console.log(`   Found ${count.length} appointment(s)`);

    if (dryRun) {
      console.log('');
      console.log('⚠️  DRY RUN MODE - No changes applied');
    } else {
      console.log('');
      console.log('✅ Migration completed successfully');
    }
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await client.end();
  }
}

main();
