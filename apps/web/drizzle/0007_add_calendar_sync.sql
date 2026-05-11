CREATE TABLE IF NOT EXISTS "calendar_access_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"vet_id" uuid NOT NULL,
	"token" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"description" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"last_used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "calendar_access_tokens_token_unique" UNIQUE("token"),
	CONSTRAINT "calendar_access_tokens_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE cascade,
	CONSTRAINT "calendar_access_tokens_vet_id_fkey" FOREIGN KEY ("vet_id") REFERENCES "users"("id") ON DELETE cascade
);

CREATE TABLE IF NOT EXISTS "calendar_access_audit" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token_id" uuid,
	"tenant_id" uuid NOT NULL,
	"veterinarian_id" uuid NOT NULL,
	"accessed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip_address" varchar(45),
	"user_agent" text,
	"event_count" integer DEFAULT 0,
	"http_status" integer,
	CONSTRAINT "calendar_access_audit_token_id_fkey" FOREIGN KEY ("token_id") REFERENCES "calendar_access_tokens"("id") ON DELETE cascade,
	CONSTRAINT "calendar_access_audit_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE cascade,
	CONSTRAINT "calendar_access_audit_veterinarian_id_fkey" FOREIGN KEY ("veterinarian_id") REFERENCES "users"("id") ON DELETE cascade
);

CREATE INDEX IF NOT EXISTS "calendar_tokens_tenant_vet_idx" ON "calendar_access_tokens" ("tenant_id","vet_id");
CREATE INDEX IF NOT EXISTS "calendar_tokens_tenant_id_idx" ON "calendar_access_tokens" ("tenant_id");
CREATE INDEX IF NOT EXISTS "calendar_audit_tenant_id_idx" ON "calendar_access_audit" ("tenant_id");
CREATE INDEX IF NOT EXISTS "calendar_audit_token_id_idx" ON "calendar_access_audit" ("token_id");
CREATE INDEX IF NOT EXISTS "calendar_audit_accessed_at_idx" ON "calendar_access_audit" ("accessed_at");
