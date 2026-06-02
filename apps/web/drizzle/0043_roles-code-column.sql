ALTER TABLE "roles" ADD COLUMN IF NOT EXISTS "code" varchar(50) NOT NULL DEFAULT '';--> statement-breakpoint
ALTER TABLE "roles" ADD COLUMN IF NOT EXISTS "is_editable_by_tenant" boolean NOT NULL DEFAULT false;--> statement-breakpoint
ALTER TABLE "roles" ADD COLUMN IF NOT EXISTS "base_version" integer NOT NULL DEFAULT 1;--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'roles_tenant_code_idx'
  ) THEN
    ALTER TABLE "roles" ADD CONSTRAINT "roles_tenant_code_idx" UNIQUE("tenant_id","code");
  END IF;
END $$;
