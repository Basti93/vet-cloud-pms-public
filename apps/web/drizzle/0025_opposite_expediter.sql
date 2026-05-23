ALTER TABLE IF EXISTS "tenant_domains" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE IF EXISTS "tenant_domains" CASCADE;--> statement-breakpoint
DROP INDEX IF EXISTS "tenants_custom_domain_idx";--> statement-breakpoint
ALTER TABLE "website_projects" ADD COLUMN "custom_css" text;--> statement-breakpoint
ALTER TABLE "tenants" DROP COLUMN "website_published";--> statement-breakpoint
ALTER TABLE "tenants" DROP COLUMN "website_content";--> statement-breakpoint
ALTER TABLE "tenants" DROP COLUMN "website_seo";--> statement-breakpoint
ALTER TABLE "tenants" DROP COLUMN "custom_domain";