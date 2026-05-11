-- Add Stripe subscription tracking to tenants table
ALTER TABLE tenants ADD COLUMN stripe_customer_id varchar(255);
ALTER TABLE tenants ADD COLUMN stripe_subscription_id varchar(255);
ALTER TABLE tenants ADD COLUMN current_stripe_price_id varchar(255);
ALTER TABLE tenants ADD COLUMN trial_ends_at timestamp with time zone;
ALTER TABLE tenants ADD COLUMN deactivated_at timestamp with time zone;
ALTER TABLE tenants ADD COLUMN last_payment_failed_at timestamp with time zone;

-- Unique constraint on Stripe customer ID
CREATE UNIQUE INDEX tenants_stripe_customer_id_idx ON tenants(stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;
