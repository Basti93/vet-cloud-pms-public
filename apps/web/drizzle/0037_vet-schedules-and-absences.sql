-- vet_schedules: migrate from start_hour/end_hour/is_working_day to slots (jsonb)
ALTER TABLE "vet_schedules" ADD COLUMN IF NOT EXISTS "slots" jsonb NOT NULL DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "vet_schedules" DROP COLUMN IF EXISTS "start_hour";--> statement-breakpoint
ALTER TABLE "vet_schedules" DROP COLUMN IF EXISTS "end_hour";--> statement-breakpoint
ALTER TABLE "vet_schedules" DROP COLUMN IF EXISTS "is_working_day";--> statement-breakpoint

-- vet_absences: new table for vacation/sick/other absences
CREATE TABLE IF NOT EXISTS "vet_absences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"vet_id" uuid NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"type" varchar(20) DEFAULT 'vacation' NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "vet_absences" ADD CONSTRAINT "vet_absences_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "vet_absences" ADD CONSTRAINT "vet_absences_vet_id_users_id_fk" FOREIGN KEY ("vet_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "vet_absences_tenant_vet_idx" ON "vet_absences" ("tenant_id","vet_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "vet_absences_date_range_idx" ON "vet_absences" ("start_date","end_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "vet_schedules_tenant_vet_idx" ON "vet_schedules" ("tenant_id","vet_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "vet_schedules_day_idx" ON "vet_schedules" ("day_of_week");
