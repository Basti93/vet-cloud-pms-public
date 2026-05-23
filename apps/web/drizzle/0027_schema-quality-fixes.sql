ALTER TABLE "calendar_access_tokens" DROP CONSTRAINT IF EXISTS "calendar_tokens_token_unique";--> statement-breakpoint
DROP INDEX "email_settings_tenant_id_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "feature_flags_tenant_id_idx";--> statement-breakpoint
DROP INDEX "vaccination_settings_tenant_id_idx";--> statement-breakpoint
CREATE INDEX "medications_prescribed_by_idx" ON "medications" USING btree ("prescribed_by");