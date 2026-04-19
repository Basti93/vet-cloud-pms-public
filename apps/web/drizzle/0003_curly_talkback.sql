ALTER TABLE "tenants" ADD COLUMN "tagline" varchar(255);--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "monogram" varchar(3);--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "theme_preference" varchar(50) DEFAULT 'sage' NOT NULL;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "typography_preference" varchar(50) DEFAULT 'modern' NOT NULL;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "website_template" varchar(50) DEFAULT 'modern' NOT NULL;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "custom_website_code" text;