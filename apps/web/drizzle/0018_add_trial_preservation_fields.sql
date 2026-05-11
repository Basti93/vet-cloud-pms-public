DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenants' AND column_name = 'trial_days_used') THEN
    ALTER TABLE tenants ADD COLUMN trial_days_used SMALLINT DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenants' AND column_name = 'original_trial_ends_at') THEN
    ALTER TABLE tenants ADD COLUMN original_trial_ends_at TIMESTAMP WITH TIME ZONE;
  END IF;
END $$;
