ALTER TABLE tenants ADD COLUMN payment_failure_count SMALLINT DEFAULT 0;
ALTER TABLE tenants ADD COLUMN payment_grace_period_ends_at TIMESTAMP WITH TIME ZONE;
