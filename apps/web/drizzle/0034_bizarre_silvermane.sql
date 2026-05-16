ALTER TABLE "owners" ADD COLUMN IF NOT EXISTS "active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "owners_tenant_email_unique" ON "owners" USING btree ("tenant_id",lower("email")) WHERE "owners"."email" is not null;
