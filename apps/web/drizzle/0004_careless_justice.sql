CREATE TABLE "email_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"confirmation_email_enabled" boolean DEFAULT true NOT NULL,
	"reminder_email_enabled" boolean DEFAULT true NOT NULL,
	"reminder_hours_before" smallint DEFAULT 24 NOT NULL,
	"booking_notification_enabled" boolean DEFAULT true NOT NULL,
	"sender_name" varchar(100) DEFAULT 'VetCloud PMS' NOT NULL,
	"confirmation_subject" varchar(255) DEFAULT 'Bestätigung: Ihr Termin bei {practiceName}' NOT NULL,
	"confirmation_body" text DEFAULT 'Hallo {ownerFirstName},

Ihr Termin für {patientName} am {appointmentDate} um {appointmentTime} wurde bestätigt.

Beste Grüße,
{practiceName}' NOT NULL,
	"reminder_subject" varchar(255) DEFAULT 'Erinnerung: Termin morgen bei {practiceName}' NOT NULL,
	"reminder_body" text DEFAULT 'Hallo {ownerFirstName},

Ihr Termin für {patientName} findet morgen um {appointmentTime} statt.

Beste Grüße,
{practiceName}' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "email_settings_tenant_id_unique" UNIQUE("tenant_id")
);
--> statement-breakpoint
ALTER TABLE "email_settings" ADD CONSTRAINT "email_settings_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "email_settings_tenant_id_idx" ON "email_settings" USING btree ("tenant_id");