CREATE TABLE "standalone_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"email" varchar(255) NOT NULL,
	"billing_ref" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "website_asset_usages" (
	"asset_id" uuid NOT NULL,
	"page_id" uuid NOT NULL,
	"block_id" varchar(120) NOT NULL,
	"field_path" varchar(255) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "website_asset_usages_asset_id_page_id_block_id_field_path_pk" PRIMARY KEY("asset_id","page_id","block_id","field_path")
);
--> statement-breakpoint
CREATE TABLE "website_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"website_project_id" uuid NOT NULL,
	"storage_key" varchar(500) NOT NULL,
	"url" text NOT NULL,
	"mime_type" varchar(120) NOT NULL,
	"size_bytes" integer NOT NULL,
	"width" integer,
	"height" integer,
	"alt" text,
	"focal_point" jsonb,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "website_assets_storage_key_idx" UNIQUE("storage_key")
);
--> statement-breakpoint
CREATE TABLE "website_domains" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"website_project_id" uuid NOT NULL,
	"domain" varchar(255) NOT NULL,
	"type" varchar(20) DEFAULT 'alias' NOT NULL,
	"status" varchar(30) DEFAULT 'pending' NOT NULL,
	"verification_method" varchar(20) DEFAULT 'txt',
	"verification_token" varchar(255),
	"verified_at" timestamp with time zone,
	"last_checked_at" timestamp with time zone,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "website_domains_domain_idx" UNIQUE("domain")
);
--> statement-breakpoint
CREATE TABLE "website_leads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"website_project_id" uuid NOT NULL,
	"source_page_path" varchar(255),
	"name" varchar(120) NOT NULL,
	"email" varchar(180) NOT NULL,
	"phone" varchar(80),
	"message" text NOT NULL,
	"consent" boolean DEFAULT false NOT NULL,
	"status" varchar(20) DEFAULT 'new' NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "website_page_revisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"website_page_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"state" varchar(20) DEFAULT 'draft' NOT NULL,
	"blocks" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "website_page_revisions_page_version_idx" UNIQUE("website_page_id","version")
);
--> statement-breakpoint
CREATE TABLE "website_pages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"website_project_id" uuid NOT NULL,
	"path" varchar(255) NOT NULL,
	"page_type" varchar(30) DEFAULT 'default' NOT NULL,
	"title" varchar(255) NOT NULL,
	"is_homepage" boolean DEFAULT false NOT NULL,
	"seo_config" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "website_pages_project_path_idx" UNIQUE("website_project_id","path")
);
--> statement-breakpoint
CREATE TABLE "website_projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_type" varchar(20) NOT NULL,
	"owner_tenant_id" uuid,
	"owner_standalone_id" uuid,
	"name" varchar(255) NOT NULL,
	"slug" varchar(120) NOT NULL,
	"status" varchar(20) DEFAULT 'draft' NOT NULL,
	"primary_domain" varchar(255),
	"layout_key" varchar(80) DEFAULT 'praxis-classic' NOT NULL,
	"layout_version" integer DEFAULT 1 NOT NULL,
	"theme_config" jsonb,
	"capabilities" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"seo_config" jsonb,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "website_projects_slug_idx" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "website_asset_usages" ADD CONSTRAINT "website_asset_usages_asset_id_website_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."website_assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "website_asset_usages" ADD CONSTRAINT "website_asset_usages_page_id_website_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."website_pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "website_assets" ADD CONSTRAINT "website_assets_website_project_id_website_projects_id_fk" FOREIGN KEY ("website_project_id") REFERENCES "public"."website_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "website_assets" ADD CONSTRAINT "website_assets_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "website_domains" ADD CONSTRAINT "website_domains_website_project_id_website_projects_id_fk" FOREIGN KEY ("website_project_id") REFERENCES "public"."website_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "website_leads" ADD CONSTRAINT "website_leads_website_project_id_website_projects_id_fk" FOREIGN KEY ("website_project_id") REFERENCES "public"."website_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "website_page_revisions" ADD CONSTRAINT "website_page_revisions_website_page_id_website_pages_id_fk" FOREIGN KEY ("website_page_id") REFERENCES "public"."website_pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "website_page_revisions" ADD CONSTRAINT "website_page_revisions_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "website_pages" ADD CONSTRAINT "website_pages_website_project_id_website_projects_id_fk" FOREIGN KEY ("website_project_id") REFERENCES "public"."website_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "website_projects" ADD CONSTRAINT "website_projects_owner_tenant_id_tenants_id_fk" FOREIGN KEY ("owner_tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "website_projects" ADD CONSTRAINT "website_projects_owner_standalone_id_standalone_accounts_id_fk" FOREIGN KEY ("owner_standalone_id") REFERENCES "public"."standalone_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "standalone_accounts_email_idx" ON "standalone_accounts" USING btree ("email");--> statement-breakpoint
CREATE INDEX "website_asset_usages_asset_idx" ON "website_asset_usages" USING btree ("asset_id");--> statement-breakpoint
CREATE INDEX "website_asset_usages_page_idx" ON "website_asset_usages" USING btree ("page_id");--> statement-breakpoint
CREATE INDEX "website_assets_project_idx" ON "website_assets" USING btree ("website_project_id");--> statement-breakpoint
CREATE INDEX "website_domains_project_idx" ON "website_domains" USING btree ("website_project_id");--> statement-breakpoint
CREATE INDEX "website_domains_status_idx" ON "website_domains" USING btree ("status");--> statement-breakpoint
CREATE INDEX "website_leads_project_idx" ON "website_leads" USING btree ("website_project_id");--> statement-breakpoint
CREATE INDEX "website_leads_status_idx" ON "website_leads" USING btree ("status");--> statement-breakpoint
CREATE INDEX "website_leads_created_at_idx" ON "website_leads" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "website_page_revisions_page_state_idx" ON "website_page_revisions" USING btree ("website_page_id","state","created_at");--> statement-breakpoint
CREATE INDEX "website_pages_project_idx" ON "website_pages" USING btree ("website_project_id");--> statement-breakpoint
CREATE INDEX "website_pages_homepage_idx" ON "website_pages" USING btree ("website_project_id","is_homepage");--> statement-breakpoint
CREATE INDEX "website_projects_owner_tenant_idx" ON "website_projects" USING btree ("owner_tenant_id");--> statement-breakpoint
CREATE INDEX "website_projects_owner_standalone_idx" ON "website_projects" USING btree ("owner_standalone_id");--> statement-breakpoint
CREATE INDEX "website_projects_status_idx" ON "website_projects" USING btree ("status");