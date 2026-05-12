/**
 * One-time setup: create the E2E test tenant and link the Clerk test user.
 *
 * Run ONCE on staging (and locally if needed):
 *   npx tsx scripts/create-e2e-tenant.ts
 *
 * Safe to re-run — all inserts are ON CONFLICT DO NOTHING.
 *
 * Requires in env (.env.local locally, Coolify env on staging):
 *   DATABASE_URL, E2E_TENANT_ID, E2E_TENANT_SLUG, E2E_CLERK_USER_ID, E2E_EMAIL
 */
import path from "path";
import fs from "fs";
import postgres from "postgres";

// Load .env.local when running locally
const envPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  envContent.split("\n").forEach((line) => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#")) {
      const [key, ...valueParts] = trimmed.split("=");
      if (key && valueParts.length > 0) {
        process.env[key.trim()] = valueParts.join("=").trim();
      }
    }
  });
}

const DATABASE_URL = process.env.DATABASE_URL;
const E2E_TENANT_ID = process.env.E2E_TENANT_ID;
const E2E_TENANT_SLUG = process.env.E2E_TENANT_SLUG;
const E2E_CLERK_USER_ID = process.env.E2E_CLERK_USER_ID;
const E2E_EMAIL = process.env.E2E_EMAIL;

if (!DATABASE_URL) throw new Error("DATABASE_URL not set");
if (!E2E_TENANT_ID) throw new Error("E2E_TENANT_ID not set");
if (!E2E_TENANT_SLUG) throw new Error("E2E_TENANT_SLUG not set");
if (!E2E_CLERK_USER_ID) throw new Error("E2E_CLERK_USER_ID not set");
if (!E2E_EMAIL) throw new Error("E2E_EMAIL not set");

const sslUrl =
  DATABASE_URL + (DATABASE_URL.includes("?") ? "&sslmode=require" : "?sslmode=require");
const sql = postgres(sslUrl, { max: 1 });

async function main() {
  try {
    // 1. Tenant
    await sql`
      INSERT INTO tenants (
        id, name, slug, email, phone, address, city, postal_code, country,
        subscription_status, subscription_plan, max_users, trial_ends_at
      ) VALUES (
        ${E2E_TENANT_ID!}::uuid,
        'E2E Test Praxis',
        ${E2E_TENANT_SLUG!},
        ${E2E_EMAIL!},
        '+49 30 000000',
        'Teststraße 1',
        'Berlin',
        '10115',
        'DE',
        'active',
        'starter',
        5,
        NOW() + INTERVAL '365 days'
      )
      ON CONFLICT (id) DO NOTHING;
    `;
    console.log("✅ Tenant:", E2E_TENANT_SLUG, "(", E2E_TENANT_ID, ")");

    // 2. Admin role for the E2E tenant
    const roleRows = await sql`
      INSERT INTO roles (tenant_id, code, name, description, is_system, base_version)
      VALUES (
        ${E2E_TENANT_ID!}::uuid,
        'admin',
        'Admin',
        'Full access',
        true,
        1
      )
      ON CONFLICT (tenant_id, code) DO NOTHING
      RETURNING id;
    `;

    const adminRoleId =
      roleRows[0]?.id ??
      (
        await sql<{ id: string }[]>`
          SELECT id FROM roles WHERE tenant_id = ${E2E_TENANT_ID!}::uuid AND code = 'admin'
        `
      )[0]?.id;

    if (!adminRoleId) throw new Error("Could not resolve admin role ID");
    console.log("✅ Admin role:", adminRoleId);

    // 3. User row linked to Clerk ID
    const userRows = await sql`
      INSERT INTO users (tenant_id, clerk_id, email, first_name, last_name, active)
      VALUES (
        ${E2E_TENANT_ID!}::uuid,
        ${E2E_CLERK_USER_ID!},
        ${E2E_EMAIL!},
        'E2E',
        'Test',
        true
      )
      ON CONFLICT (clerk_id) DO NOTHING
      RETURNING id;
    `;

    const userId =
      userRows[0]?.id ??
      (
        await sql<{ id: string }[]>`
          SELECT id FROM users WHERE clerk_id = ${E2E_CLERK_USER_ID!}
        `
      )[0]?.id;

    if (!userId) throw new Error("Could not resolve E2E user row ID");
    console.log("✅ User:", userId, "(", E2E_CLERK_USER_ID, ")");

    // 4. Assign admin role
    await sql`
      INSERT INTO user_roles (user_id, role_id)
      VALUES (${userId}::uuid, ${adminRoleId}::uuid)
      ON CONFLICT DO NOTHING;
    `;
    console.log("✅ Admin role assigned to user");

    // 5. Email settings (expected by dashboard queries)
    await sql`
      INSERT INTO email_settings (tenant_id, reminder_email_enabled, reminder_hours_before)
      VALUES (${E2E_TENANT_ID!}::uuid, false, 24)
      ON CONFLICT (tenant_id) DO NOTHING;
    `;
    console.log("✅ Email settings");

    console.log("\n🎉 E2E tenant ready. Booking URL: /book/" + E2E_TENANT_SLUG);
  } catch (err) {
    console.error("❌ Error:", err);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

main();
