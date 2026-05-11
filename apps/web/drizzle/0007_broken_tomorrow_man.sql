DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenants' AND column_name = 'stripe_customer_id') THEN
    ALTER TABLE "tenants" ADD COLUMN "stripe_customer_id" varchar(255);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenants' AND column_name = 'stripe_subscription_id') THEN
    ALTER TABLE "tenants" ADD COLUMN "stripe_subscription_id" varchar(255);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenants' AND column_name = 'current_stripe_price_id') THEN
    ALTER TABLE "tenants" ADD COLUMN "current_stripe_price_id" varchar(255);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenants' AND column_name = 'trial_ends_at') THEN
    ALTER TABLE "tenants" ADD COLUMN "trial_ends_at" timestamp with time zone;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenants' AND column_name = 'deactivated_at') THEN
    ALTER TABLE "tenants" ADD COLUMN "deactivated_at" timestamp with time zone;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenants' AND column_name = 'last_payment_failed_at') THEN
    ALTER TABLE "tenants" ADD COLUMN "last_payment_failed_at" timestamp with time zone;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenants' AND column_name = 'cancelled_at_period_end') THEN
    ALTER TABLE "tenants" ADD COLUMN "cancelled_at_period_end" timestamp with time zone;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenants' AND column_name = 'payment_failure_count') THEN
    ALTER TABLE "tenants" ADD COLUMN "payment_failure_count" smallint DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenants' AND column_name = 'payment_grace_period_ends_at') THEN
    ALTER TABLE "tenants" ADD COLUMN "payment_grace_period_ends_at" timestamp with time zone;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenants' AND column_name = 'trial_days_used') THEN
    ALTER TABLE "tenants" ADD COLUMN "trial_days_used" smallint DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenants' AND column_name = 'original_trial_ends_at') THEN
    ALTER TABLE "tenants" ADD COLUMN "original_trial_ends_at" timestamp with time zone;
  END IF;
END $$;
