DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenants' AND column_name = 'payment_failure_count') THEN
    ALTER TABLE tenants ADD COLUMN payment_failure_count SMALLINT DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenants' AND column_name = 'payment_grace_period_ends_at') THEN
    ALTER TABLE tenants ADD COLUMN payment_grace_period_ends_at TIMESTAMP WITH TIME ZONE;
  END IF;
END $$;
