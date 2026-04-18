CREATE TABLE "appointment_holds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"slot_datetime" timestamp with time zone NOT NULL,
	"vet_id" uuid,
	"session_token" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "appointment_holds_session_token_unique" UNIQUE("session_token")
);
--> statement-breakpoint
ALTER TABLE "appointment_holds" ADD CONSTRAINT "appointment_holds_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointment_holds" ADD CONSTRAINT "appointment_holds_vet_id_users_id_fk" FOREIGN KEY ("vet_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "appointment_holds_tenant_slot_idx" ON "appointment_holds" USING btree ("tenant_id","slot_datetime");--> statement-breakpoint
CREATE INDEX "appointment_holds_expires_at_idx" ON "appointment_holds" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "appointment_holds_session_token_idx" ON "appointment_holds" USING btree ("session_token");