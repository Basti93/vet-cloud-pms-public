CREATE TABLE "email_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid,
	"email_type" varchar(60) NOT NULL,
	"recipient_email" varchar(255) NOT NULL,
	"status" varchar(20) NOT NULL,
	"error_message" text,
	"message_id" varchar(255),
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "email_logs" ADD CONSTRAINT "email_logs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX "email_logs_tenant_id_idx" ON "email_logs" USING btree ("tenant_id");
--> statement-breakpoint
CREATE INDEX "email_logs_status_sent_at_idx" ON "email_logs" USING btree ("status","sent_at");
--> statement-breakpoint
CREATE INDEX "email_logs_email_type_idx" ON "email_logs" USING btree ("email_type");
