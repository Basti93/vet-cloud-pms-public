DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenant_deletion_schedules' AND column_name = 'previous_subscription_status') THEN
    ALTER TABLE "tenant_deletion_schedules" ADD COLUMN "previous_subscription_status" varchar(20);
  END IF;
END $$;
