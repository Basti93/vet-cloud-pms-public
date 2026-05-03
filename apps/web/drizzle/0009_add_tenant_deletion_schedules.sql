CREATE TABLE "tenant_deletion_schedules" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "requested_by_user_id" uuid,
  "status" varchar(30) DEFAULT 'scheduled' NOT NULL,
  "reason" text,
  "scheduled_for" timestamp with time zone NOT NULL,
  "cancelled_at" timestamp with time zone,
  "executed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "tenant_deletion_schedules_tenant_id_unique" UNIQUE("tenant_id")
);
--> statement-breakpoint
ALTER TABLE "tenant_deletion_schedules"
  ADD CONSTRAINT "tenant_deletion_schedules_tenant_id_tenants_id_fk"
  FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "tenant_deletion_schedules"
  ADD CONSTRAINT "tenant_deletion_schedules_requested_by_user_id_users_id_fk"
  FOREIGN KEY ("requested_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "tenant_deletion_schedules_status_scheduled_for_idx"
  ON "tenant_deletion_schedules" USING btree ("status","scheduled_for");
--> statement-breakpoint
CREATE INDEX "tenant_deletion_schedules_tenant_id_idx"
  ON "tenant_deletion_schedules" USING btree ("tenant_id");
