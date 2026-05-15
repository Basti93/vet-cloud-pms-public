ALTER TABLE "tenants" ADD COLUMN "website_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "preview_token" varchar(64);