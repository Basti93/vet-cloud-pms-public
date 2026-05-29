CREATE TABLE IF NOT EXISTS "user_feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" uuid,
	"source_path" varchar(500) NOT NULL,
	"source_module" varchar(80) NOT NULL,
	"message" text NOT NULL,
	"category" varchar(30) DEFAULT 'other' NOT NULL,
	"status" varchar(30) DEFAULT 'new' NOT NULL,
	"priority" varchar(20) DEFAULT 'normal' NOT NULL,
	"triage_notes" text,
	"updated_by_admin_clerk_id" varchar(255),
	"ip_address" varchar(45),
	"user_agent" text,
	"browser_metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM pg_constraint WHERE conname = 'user_feedback_tenant_id_tenants_id_fk'
	) THEN
		ALTER TABLE "user_feedback"
			ADD CONSTRAINT "user_feedback_tenant_id_tenants_id_fk"
			FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id")
			ON DELETE cascade ON UPDATE no action;
	END IF;

	IF NOT EXISTS (
		SELECT 1 FROM pg_constraint WHERE conname = 'user_feedback_user_id_users_id_fk'
	) THEN
		ALTER TABLE "user_feedback"
			ADD CONSTRAINT "user_feedback_user_id_users_id_fk"
			FOREIGN KEY ("user_id") REFERENCES "public"."users"("id")
			ON DELETE set null ON UPDATE no action;
	END IF;
END
$$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_feedback_tenant_id_idx" ON "user_feedback" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_feedback_tenant_status_idx" ON "user_feedback" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_feedback_status_idx" ON "user_feedback" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_feedback_category_idx" ON "user_feedback" USING btree ("category");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_feedback_source_module_idx" ON "user_feedback" USING btree ("source_module");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_feedback_created_at_idx" ON "user_feedback" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_feedback_admin_list_idx" ON "user_feedback" USING btree ("status","priority","created_at");--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "user_feedback" TO app_user;--> statement-breakpoint
ALTER TABLE "user_feedback" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM pg_policies
		WHERE schemaname = 'public'
			AND tablename = 'user_feedback'
			AND policyname = 'tenant_read'
	) THEN
		CREATE POLICY tenant_read ON "user_feedback" FOR SELECT TO app_user
			USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
	END IF;

	IF NOT EXISTS (
		SELECT 1 FROM pg_policies
		WHERE schemaname = 'public'
			AND tablename = 'user_feedback'
			AND policyname = 'tenant_write'
	) THEN
		CREATE POLICY tenant_write ON "user_feedback" FOR ALL TO app_user
			USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
			WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
	END IF;
END
$$;
