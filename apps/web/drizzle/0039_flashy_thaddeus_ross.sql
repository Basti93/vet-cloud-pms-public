ALTER TABLE "tenants" ALTER COLUMN "subscription_plan" SET DEFAULT 'solo';--> statement-breakpoint
ALTER TABLE "tenants" ALTER COLUMN "max_users" SET DEFAULT 3;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "billing_interval" varchar(10) DEFAULT 'monthly' NOT NULL;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "has_website_builder" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "website_builder_price_id" varchar(255);--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "pioneer_tier" varchar(20) DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE "website_projects" ADD COLUMN IF NOT EXISTS "preview_token" varchar(64);--> statement-breakpoint
ALTER TABLE "owners" DROP COLUMN IF EXISTS "provisional";--> statement-breakpoint
ALTER TABLE "patients" DROP COLUMN IF EXISTS "provisional";
