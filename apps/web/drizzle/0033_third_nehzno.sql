-- Migrate old plan enum values to new tier names
UPDATE "tenants" SET subscription_plan = 'solo' WHERE subscription_plan = 'free';--> statement-breakpoint
UPDATE "tenants" SET subscription_plan = 'praxis' WHERE subscription_plan IN ('starter', 'pro');--> statement-breakpoint
UPDATE "tenants" SET subscription_plan = 'klinik' WHERE subscription_plan = 'enterprise';--> statement-breakpoint
ALTER TABLE "tenants" ALTER COLUMN "subscription_plan" SET DEFAULT 'solo';--> statement-breakpoint
ALTER TABLE "tenants" ALTER COLUMN "max_users" SET DEFAULT 3;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "billing_interval" varchar(10) DEFAULT 'monthly' NOT NULL;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "has_website_builder" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "website_builder_price_id" varchar(255);--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "pioneer_tier" varchar(20) DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE "owners" DROP COLUMN IF EXISTS "provisional";--> statement-breakpoint
ALTER TABLE "patients" DROP COLUMN IF EXISTS "provisional";