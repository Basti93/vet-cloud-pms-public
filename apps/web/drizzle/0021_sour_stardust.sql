CREATE TABLE "tenant_website_contact_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" varchar(120) NOT NULL,
	"email" varchar(180) NOT NULL,
	"phone" varchar(80),
	"message" text NOT NULL,
	"email_status" varchar(20) DEFAULT 'pending' NOT NULL,
	"email_sent_at" timestamp with time zone,
	"email_error" text,
	"ip_address" varchar(45),
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tenant_website_contact_requests" ADD CONSTRAINT "tenant_website_contact_requests_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tenant_website_contact_requests_tenant_id_idx" ON "tenant_website_contact_requests" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "tenant_website_contact_requests_created_at_idx" ON "tenant_website_contact_requests" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "tenant_website_contact_requests_email_status_idx" ON "tenant_website_contact_requests" USING btree ("email_status");
