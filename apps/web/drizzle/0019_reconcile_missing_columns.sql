DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenants' AND column_name = 'allowed_embedding_domains') THEN
    ALTER TABLE tenants ADD COLUMN allowed_embedding_domains jsonb;
  END IF;
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
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenants' AND column_name = 'cancelled_at_period_end') THEN
    ALTER TABLE tenants ADD COLUMN cancelled_at_period_end timestamp with time zone;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenants' AND column_name = 'payment_failure_count') THEN
    ALTER TABLE tenants ADD COLUMN payment_failure_count smallint DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenants' AND column_name = 'payment_grace_period_ends_at') THEN
    ALTER TABLE tenants ADD COLUMN payment_grace_period_ends_at timestamp with time zone;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenants' AND column_name = 'trial_days_used') THEN
    ALTER TABLE tenants ADD COLUMN trial_days_used smallint DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenants' AND column_name = 'original_trial_ends_at') THEN
    ALTER TABLE tenants ADD COLUMN original_trial_ends_at timestamp with time zone;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS tenants_stripe_customer_id_idx ON tenants(stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS calendar_access_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  tenant_id uuid NOT NULL,
  vet_id uuid NOT NULL,
  token text NOT NULL,
  is_active boolean DEFAULT true NOT NULL,
  description varchar(255),
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  created_by uuid,
  last_used_at timestamp with time zone,
  revoked_at timestamp with time zone,
  CONSTRAINT calendar_access_tokens_token_unique UNIQUE(token),
  CONSTRAINT calendar_access_tokens_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE cascade,
  CONSTRAINT calendar_access_tokens_vet_id_fkey FOREIGN KEY (vet_id) REFERENCES users(id) ON DELETE cascade
);

CREATE TABLE IF NOT EXISTS calendar_access_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  token_id uuid,
  tenant_id uuid NOT NULL,
  veterinarian_id uuid NOT NULL,
  accessed_at timestamp with time zone DEFAULT now() NOT NULL,
  ip_address varchar(45),
  user_agent text,
  event_count integer DEFAULT 0,
  http_status integer,
  CONSTRAINT calendar_access_audit_token_id_fkey FOREIGN KEY (token_id) REFERENCES calendar_access_tokens(id) ON DELETE cascade,
  CONSTRAINT calendar_access_audit_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE cascade,
  CONSTRAINT calendar_access_audit_veterinarian_id_fkey FOREIGN KEY (veterinarian_id) REFERENCES users(id) ON DELETE cascade
);

CREATE INDEX IF NOT EXISTS calendar_tokens_tenant_vet_idx ON calendar_access_tokens (tenant_id, vet_id);
CREATE INDEX IF NOT EXISTS calendar_tokens_tenant_id_idx ON calendar_access_tokens (tenant_id);
CREATE INDEX IF NOT EXISTS calendar_audit_tenant_id_idx ON calendar_access_audit (tenant_id);
CREATE INDEX IF NOT EXISTS calendar_audit_token_id_idx ON calendar_access_audit (token_id);
CREATE INDEX IF NOT EXISTS calendar_audit_accessed_at_idx ON calendar_access_audit (accessed_at);

CREATE TABLE IF NOT EXISTS user_roles (
  user_id uuid NOT NULL,
  role_id uuid NOT NULL,
  assigned_at timestamp with time zone DEFAULT now() NOT NULL,
  assigned_by uuid,
  CONSTRAINT user_roles_pk PRIMARY KEY(user_id, role_id),
  CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE cascade,
  CONSTRAINT user_roles_role_id_fkey FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE cascade,
  CONSTRAINT user_roles_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE set null
);

CREATE INDEX IF NOT EXISTS user_roles_user_id_idx ON user_roles (user_id);
CREATE INDEX IF NOT EXISTS user_roles_role_id_idx ON user_roles (role_id);
CREATE INDEX IF NOT EXISTS user_roles_assigned_by_idx ON user_roles (assigned_by);

CREATE TABLE IF NOT EXISTS tenant_deletion_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  tenant_id uuid NOT NULL,
  requested_by_user_id uuid,
  status varchar(30) DEFAULT 'scheduled' NOT NULL,
  reason text,
  scheduled_for timestamp with time zone NOT NULL,
  cancelled_at timestamp with time zone,
  executed_at timestamp with time zone,
  reactivation_token varchar(255),
  reactivation_token_expires_at timestamp with time zone,
  previous_subscription_status varchar(20),
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT tenant_deletion_schedules_tenant_id_unique UNIQUE(tenant_id)
);

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'tenant_deletion_schedules' AND constraint_name = 'tenant_deletion_schedules_tenant_id_tenants_id_fk'
  ) THEN
    ALTER TABLE tenant_deletion_schedules
      ADD CONSTRAINT tenant_deletion_schedules_tenant_id_tenants_id_fk
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE cascade ON UPDATE no action;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'tenant_deletion_schedules' AND constraint_name = 'tenant_deletion_schedules_requested_by_user_id_users_id_fk'
  ) THEN
    ALTER TABLE tenant_deletion_schedules
      ADD CONSTRAINT tenant_deletion_schedules_requested_by_user_id_users_id_fk
      FOREIGN KEY (requested_by_user_id) REFERENCES users(id) ON DELETE set null ON UPDATE no action;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS tenant_deletion_schedules_status_scheduled_for_idx ON tenant_deletion_schedules (status, scheduled_for);
CREATE INDEX IF NOT EXISTS tenant_deletion_schedules_tenant_id_idx ON tenant_deletion_schedules (tenant_id);
CREATE INDEX IF NOT EXISTS tenant_deletion_schedules_reactivation_token_idx ON tenant_deletion_schedules (reactivation_token);

DROP TABLE IF EXISTS account_deletion_requests;
