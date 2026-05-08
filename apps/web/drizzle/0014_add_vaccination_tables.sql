CREATE TABLE IF NOT EXISTS "vaccination_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(30) NOT NULL,
	"name" varchar(150) NOT NULL,
	"species" varchar(200) NOT NULL,
	"category" varchar(20) DEFAULT 'recommended' NOT NULL,
	"default_interval_months" integer NOT NULL,
	"series_doses" integer DEFAULT 1 NOT NULL,
	"min_interval_days" integer,
	"requires_batch_number" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 100 NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "vaccination_types_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tenant_vaccination_type_config" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"vaccination_type_id" uuid,
	"enabled" boolean DEFAULT true NOT NULL,
	"custom_name" varchar(150),
	"custom_species" varchar(200),
	"custom_category" varchar(20),
	"custom_interval_months" integer,
	"custom_requires_batch_number" boolean DEFAULT false,
	"custom_notes" text,
	"sort_order" integer DEFAULT 100 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tenant_vax_type_config_unique" UNIQUE("tenant_id","vaccination_type_id"),
	CONSTRAINT "tenant_vaccination_type_config_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action,
	CONSTRAINT "tenant_vaccination_type_config_vaccination_type_id_vaccination_types_id_fk" FOREIGN KEY ("vaccination_type_id") REFERENCES "public"."vaccination_types"("id") ON DELETE cascade ON UPDATE no action
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "vaccinations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"vaccination_type_id" uuid,
	"tenant_vaccination_type_config_id" uuid,
	"type" varchar(120) NOT NULL,
	"administered_date" timestamp with time zone NOT NULL,
	"expiry_date" timestamp with time zone NOT NULL,
	"vet_id" uuid,
	"batch_number" varchar(120),
	"reminder_sent_date" timestamp with time zone,
	"notes" text,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "vaccinations_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action,
	CONSTRAINT "vaccinations_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action,
	CONSTRAINT "vaccinations_vaccination_type_id_vaccination_types_id_fk" FOREIGN KEY ("vaccination_type_id") REFERENCES "public"."vaccination_types"("id") ON DELETE set null ON UPDATE no action,
	CONSTRAINT "vaccinations_tenant_vaccination_type_config_id_tenant_vaccination_type_config_id_fk" FOREIGN KEY ("tenant_vaccination_type_config_id") REFERENCES "public"."tenant_vaccination_type_config"("id") ON DELETE set null ON UPDATE no action,
	CONSTRAINT "vaccinations_vet_id_users_id_fk" FOREIGN KEY ("vet_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "vaccination_settings" (
	"tenant_id" uuid PRIMARY KEY NOT NULL,
	"reminder_enabled" boolean DEFAULT true NOT NULL,
	"reminder_days_before" integer DEFAULT 30 NOT NULL,
	"remind_core" boolean DEFAULT true NOT NULL,
	"remind_recommended" boolean DEFAULT true NOT NULL,
	"remind_optional" boolean DEFAULT false NOT NULL,
	"remind_overdue" boolean DEFAULT true NOT NULL,
	"reminder_subject" varchar(255) DEFAULT 'Impf-Erinnerung für {petName}' NOT NULL,
	"reminder_body" text DEFAULT 'Hallo {ownerName},

für {petName} ist die Auffrischung ({vaccinationType}) am {dueDate} fällig.
Bitte vereinbaren Sie einen Termin bei {clinicName}.

Viele Grüße
{clinicName}' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "vaccination_settings_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "vaccination_email_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"vaccination_id" uuid NOT NULL,
	"email_address" varchar(255) NOT NULL,
	"status" varchar(20) DEFAULT 'sent' NOT NULL,
	"message_id" varchar(255),
	"error" text,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "vaccination_email_logs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action,
	CONSTRAINT "vaccination_email_logs_vaccination_id_vaccinations_id_fk" FOREIGN KEY ("vaccination_id") REFERENCES "public"."vaccinations"("id") ON DELETE cascade ON UPDATE no action
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "vaccination_types_code_idx" ON "vaccination_types" USING btree ("code");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tenant_vax_type_config_tenant_id_idx" ON "tenant_vaccination_type_config" USING btree ("tenant_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "vaccinations_tenant_id_idx" ON "vaccinations" USING btree ("tenant_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "vaccinations_patient_id_idx" ON "vaccinations" USING btree ("patient_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "vaccinations_expiry_date_idx" ON "vaccinations" USING btree ("expiry_date");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "vaccinations_tenant_expiry_reminder_idx" ON "vaccinations" USING btree ("tenant_id","expiry_date","reminder_sent_date");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "vaccination_settings_tenant_id_idx" ON "vaccination_settings" USING btree ("tenant_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "vaccination_email_logs_tenant_id_idx" ON "vaccination_email_logs" USING btree ("tenant_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "vaccination_email_logs_vaccination_id_idx" ON "vaccination_email_logs" USING btree ("vaccination_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "vaccination_email_logs_status_sent_at_idx" ON "vaccination_email_logs" USING btree ("status","sent_at");
