DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenants' AND column_name = 'stripe_customer_id') THEN
    ALTER TABLE tenants ADD COLUMN stripe_customer_id varchar(255);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenants' AND column_name = 'stripe_subscription_id') THEN
    ALTER TABLE tenants ADD COLUMN stripe_subscription_id varchar(255);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenants' AND column_name = 'current_stripe_price_id') THEN
    ALTER TABLE tenants ADD COLUMN current_stripe_price_id varchar(255);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenants' AND column_name = 'trial_ends_at') THEN
    ALTER TABLE tenants ADD COLUMN trial_ends_at timestamp with time zone;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenants' AND column_name = 'deactivated_at') THEN
    ALTER TABLE tenants ADD COLUMN deactivated_at timestamp with time zone;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenants' AND column_name = 'last_payment_failed_at') THEN
    ALTER TABLE tenants ADD COLUMN last_payment_failed_at timestamp with time zone;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS tenants_stripe_customer_id_idx ON tenants(stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;
