-- Migration: Enable Row-Level Security for all tenant-scoped tables
-- Run as superuser. app_user is the runtime role with RLS enforced.
-- Superusers retain full cross-tenant access (migrations, cron, admin dashboard).

-- ============================================================================
-- Step 1: Create runtime role
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_user') THEN
    CREATE ROLE app_user NOINHERIT LOGIN;
  END IF;
END
$$;--> statement-breakpoint

-- Grant database access
GRANT CONNECT ON DATABASE CURRENT_CATALOG TO app_user;--> statement-breakpoint

-- Grant schema access
GRANT USAGE ON SCHEMA public TO app_user;--> statement-breakpoint

-- Grant DML on all existing tables (access is further restricted by RLS policies)
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;--> statement-breakpoint

-- audit_logs: override to INSERT-only (revoke UPDATE/DELETE granted above)
REVOKE UPDATE, DELETE ON TABLE audit_logs FROM app_user;--> statement-breakpoint
-- calendar_access_audit: read + insert, no update/delete (immutable audit trail)
REVOKE UPDATE, DELETE ON TABLE calendar_access_audit FROM app_user;--> statement-breakpoint

-- Grant sequence usage for generated IDs
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;--> statement-breakpoint

-- ============================================================================
-- Step 2: ALTER DEFAULT PRIVILEGES (covers future tables/sequences)
-- ============================================================================

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user;--> statement-breakpoint

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO app_user;--> statement-breakpoint

-- ============================================================================
-- Step 3: Enable RLS on all 25 tenant-scoped tables
-- ============================================================================
-- Global tables intentionally excluded: tenants, vaccination_types, system_logs,
-- role_permissions, user_roles, standalone_accounts, website_pages,
-- website_page_revisions, website_domains, website_assets, website_asset_usages,
-- website_leads, tenant_deletion_schedules (admin cross-tenant access needed)

ALTER TABLE roles                          ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE users                          ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE tenant_website_contact_requests ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE owners                         ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE patients                       ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE appointments                   ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE voice_calls                    ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE diagnoses                      ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE medications                    ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE vitals                         ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE audit_logs                     ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE vet_schedules                  ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE vet_absences                   ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE appointment_holds              ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE email_settings                 ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE appointment_email_logs         ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE tenant_vaccination_type_config ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE vaccinations                   ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE vaccination_settings           ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE vaccination_email_logs         ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE feature_flags                  ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE calendar_access_tokens         ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE calendar_access_audit          ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE user_invitations               ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE website_projects               ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

-- ============================================================================
-- Step 4: Standard per-table policies (tenant_id column)
-- ============================================================================
-- Each table gets: tenant_read (SELECT) + tenant_write (INSERT/UPDATE/DELETE with CHECK)
-- Policy uses missing-ok flag so superuser connections (no variable set) see all rows.

-- roles
CREATE POLICY tenant_read  ON roles FOR SELECT TO app_user
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);--> statement-breakpoint
CREATE POLICY tenant_write ON roles FOR ALL    TO app_user
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);--> statement-breakpoint

-- users
CREATE POLICY tenant_read  ON users FOR SELECT TO app_user
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);--> statement-breakpoint
CREATE POLICY tenant_write ON users FOR ALL    TO app_user
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);--> statement-breakpoint

-- tenant_website_contact_requests
CREATE POLICY tenant_read  ON tenant_website_contact_requests FOR SELECT TO app_user
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);--> statement-breakpoint
CREATE POLICY tenant_write ON tenant_website_contact_requests FOR ALL    TO app_user
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);--> statement-breakpoint

-- owners
CREATE POLICY tenant_read  ON owners FOR SELECT TO app_user
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);--> statement-breakpoint
CREATE POLICY tenant_write ON owners FOR ALL    TO app_user
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);--> statement-breakpoint

-- patients
CREATE POLICY tenant_read  ON patients FOR SELECT TO app_user
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);--> statement-breakpoint
CREATE POLICY tenant_write ON patients FOR ALL    TO app_user
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);--> statement-breakpoint

-- appointments
CREATE POLICY tenant_read  ON appointments FOR SELECT TO app_user
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);--> statement-breakpoint
CREATE POLICY tenant_write ON appointments FOR ALL    TO app_user
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);--> statement-breakpoint

-- voice_calls
CREATE POLICY tenant_read  ON voice_calls FOR SELECT TO app_user
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);--> statement-breakpoint
CREATE POLICY tenant_write ON voice_calls FOR ALL    TO app_user
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);--> statement-breakpoint

-- diagnoses
CREATE POLICY tenant_read  ON diagnoses FOR SELECT TO app_user
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);--> statement-breakpoint
CREATE POLICY tenant_write ON diagnoses FOR ALL    TO app_user
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);--> statement-breakpoint

-- medications
CREATE POLICY tenant_read  ON medications FOR SELECT TO app_user
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);--> statement-breakpoint
CREATE POLICY tenant_write ON medications FOR ALL    TO app_user
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);--> statement-breakpoint

-- vitals
CREATE POLICY tenant_read  ON vitals FOR SELECT TO app_user
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);--> statement-breakpoint
CREATE POLICY tenant_write ON vitals FOR ALL    TO app_user
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);--> statement-breakpoint

-- audit_logs: INSERT-only for app_user (tamper-proof audit trail)
CREATE POLICY tenant_read   ON audit_logs FOR SELECT TO app_user
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);--> statement-breakpoint
CREATE POLICY tenant_insert ON audit_logs FOR INSERT TO app_user
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);--> statement-breakpoint

-- vet_schedules
CREATE POLICY tenant_read  ON vet_schedules FOR SELECT TO app_user
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);--> statement-breakpoint
CREATE POLICY tenant_write ON vet_schedules FOR ALL    TO app_user
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);--> statement-breakpoint

-- vet_absences
CREATE POLICY tenant_read  ON vet_absences FOR SELECT TO app_user
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);--> statement-breakpoint
CREATE POLICY tenant_write ON vet_absences FOR ALL    TO app_user
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);--> statement-breakpoint

-- appointment_holds
CREATE POLICY tenant_read  ON appointment_holds FOR SELECT TO app_user
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);--> statement-breakpoint
CREATE POLICY tenant_write ON appointment_holds FOR ALL    TO app_user
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);--> statement-breakpoint

-- email_settings
CREATE POLICY tenant_read  ON email_settings FOR SELECT TO app_user
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);--> statement-breakpoint
CREATE POLICY tenant_write ON email_settings FOR ALL    TO app_user
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);--> statement-breakpoint

-- appointment_email_logs
CREATE POLICY tenant_read  ON appointment_email_logs FOR SELECT TO app_user
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);--> statement-breakpoint
CREATE POLICY tenant_write ON appointment_email_logs FOR ALL    TO app_user
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);--> statement-breakpoint

-- tenant_vaccination_type_config
CREATE POLICY tenant_read  ON tenant_vaccination_type_config FOR SELECT TO app_user
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);--> statement-breakpoint
CREATE POLICY tenant_write ON tenant_vaccination_type_config FOR ALL    TO app_user
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);--> statement-breakpoint

-- vaccinations
CREATE POLICY tenant_read  ON vaccinations FOR SELECT TO app_user
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);--> statement-breakpoint
CREATE POLICY tenant_write ON vaccinations FOR ALL    TO app_user
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);--> statement-breakpoint

-- vaccination_settings
CREATE POLICY tenant_read  ON vaccination_settings FOR SELECT TO app_user
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);--> statement-breakpoint
CREATE POLICY tenant_write ON vaccination_settings FOR ALL    TO app_user
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);--> statement-breakpoint

-- vaccination_email_logs
CREATE POLICY tenant_read  ON vaccination_email_logs FOR SELECT TO app_user
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);--> statement-breakpoint
CREATE POLICY tenant_write ON vaccination_email_logs FOR ALL    TO app_user
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);--> statement-breakpoint

-- feature_flags
CREATE POLICY tenant_read  ON feature_flags FOR SELECT TO app_user
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);--> statement-breakpoint
CREATE POLICY tenant_write ON feature_flags FOR ALL    TO app_user
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);--> statement-breakpoint

-- calendar_access_tokens
CREATE POLICY tenant_read  ON calendar_access_tokens FOR SELECT TO app_user
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);--> statement-breakpoint
CREATE POLICY tenant_write ON calendar_access_tokens FOR ALL    TO app_user
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);--> statement-breakpoint

-- calendar_access_audit: INSERT-only (immutable access log)
CREATE POLICY tenant_read   ON calendar_access_audit FOR SELECT TO app_user
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);--> statement-breakpoint
CREATE POLICY tenant_insert ON calendar_access_audit FOR INSERT TO app_user
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);--> statement-breakpoint

-- user_invitations
CREATE POLICY tenant_read  ON user_invitations FOR SELECT TO app_user
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);--> statement-breakpoint
CREATE POLICY tenant_write ON user_invitations FOR ALL    TO app_user
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);--> statement-breakpoint

-- ============================================================================
-- Step 5: website_projects — uses owner_tenant_id (not tenant_id)
-- ============================================================================

CREATE POLICY tenant_read  ON website_projects FOR SELECT TO app_user
  USING (owner_tenant_id = current_setting('app.current_tenant_id', true)::uuid);--> statement-breakpoint
CREATE POLICY tenant_write ON website_projects FOR ALL    TO app_user
  USING (owner_tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (owner_tenant_id = current_setting('app.current_tenant_id', true)::uuid);
