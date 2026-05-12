DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenant_deletion_schedules' AND column_name = 'reactivation_token') THEN
    ALTER TABLE "tenant_deletion_schedules" ADD COLUMN "reactivation_token" varchar(255);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenant_deletion_schedules' AND column_name = 'reactivation_token_expires_at') THEN
    ALTER TABLE "tenant_deletion_schedules" ADD COLUMN "reactivation_token_expires_at" timestamp with time zone;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "tenant_deletion_schedules_reactivation_token_idx"
  ON "tenant_deletion_schedules" USING btree ("reactivation_token");
