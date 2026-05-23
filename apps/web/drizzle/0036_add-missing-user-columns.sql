ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "slot_duration_min" integer DEFAULT 30 NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "locale" varchar(10) DEFAULT 'de' NOT NULL;--> statement-breakpoint
ALTER TABLE "owners" ADD COLUMN IF NOT EXISTS "email_opt_out" boolean DEFAULT false NOT NULL;
