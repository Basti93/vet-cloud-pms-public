DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenants' AND column_name = 'cancelled_at_period_end') THEN
    ALTER TABLE tenants ADD COLUMN cancelled_at_period_end TIMESTAMP WITH TIME ZONE;
  END IF;
END $$;
