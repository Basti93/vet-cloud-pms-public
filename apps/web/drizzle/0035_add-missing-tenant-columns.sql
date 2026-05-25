ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "timezone" varchar(64) DEFAULT 'Europe/Berlin' NOT NULL;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "opening_hours" jsonb;
