CREATE TABLE "appointment_email_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"appointment_id" uuid NOT NULL,
	"email_type" varchar(50) NOT NULL,
	"recipient_email" varchar(255) NOT NULL,
	"status" varchar(50) DEFAULT 'sent' NOT NULL,
	"error_message" text,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "appointment_email_logs" ADD CONSTRAINT "appointment_email_logs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointment_email_logs" ADD CONSTRAINT "appointment_email_logs_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "appointment_email_logs_tenant_id_idx" ON "appointment_email_logs" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "appointment_email_logs_appointment_id_idx" ON "appointment_email_logs" USING btree ("appointment_id");--> statement-breakpoint
CREATE INDEX "appointment_email_logs_email_type_idx" ON "appointment_email_logs" USING btree ("email_type");--> statement-breakpoint
CREATE INDEX "appointment_email_logs_sent_at_idx" ON "appointment_email_logs" USING btree ("sent_at");