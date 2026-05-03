ALTER TABLE "tenant_deletion_schedules"
  ADD COLUMN "reactivation_token" varchar(255);
--> statement-breakpoint
ALTER TABLE "tenant_deletion_schedules"
  ADD COLUMN "reactivation_token_expires_at" timestamp with time zone;
--> statement-breakpoint
CREATE INDEX "tenant_deletion_schedules_reactivation_token_idx"
  ON "tenant_deletion_schedules" USING btree ("reactivation_token");
