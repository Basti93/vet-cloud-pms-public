DROP INDEX IF EXISTS "website_projects_owner_tenant_idx";--> statement-breakpoint
ALTER TABLE "website_projects" ADD CONSTRAINT "website_projects_owner_tenant_unique_idx" UNIQUE("owner_tenant_id");--> statement-breakpoint
ALTER TABLE "website_projects" ADD CONSTRAINT "website_projects_owner_check" CHECK (
  (owner_type = 'tenant' AND owner_tenant_id IS NOT NULL AND owner_standalone_id IS NULL) OR
  (owner_type = 'standalone' AND owner_standalone_id IS NOT NULL AND owner_tenant_id IS NULL)
);
