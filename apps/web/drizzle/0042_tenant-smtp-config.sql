ALTER TABLE "email_settings" ADD COLUMN "smtp_enabled" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "email_settings" ADD COLUMN "smtp_host" varchar(255);
--> statement-breakpoint
ALTER TABLE "email_settings" ADD COLUMN "smtp_port" smallint;
--> statement-breakpoint
ALTER TABLE "email_settings" ADD COLUMN "smtp_user" varchar(255);
--> statement-breakpoint
ALTER TABLE "email_settings" ADD COLUMN "smtp_pass_encrypted" text;
--> statement-breakpoint
ALTER TABLE "email_settings" ADD COLUMN "smtp_from_email" varchar(255);
--> statement-breakpoint
ALTER TABLE "email_settings" ADD COLUMN "smtp_from_name" varchar(100);
