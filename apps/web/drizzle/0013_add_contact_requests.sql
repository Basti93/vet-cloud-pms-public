CREATE TABLE IF NOT EXISTS "contact_requests" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" varchar(120) NOT NULL,
  "email" varchar(180) NOT NULL,
  "phone" varchar(80),
  "practice_name" varchar(160),
  "role" varchar(120),
  "website_interest" boolean DEFAULT false NOT NULL,
  "message" text,
  "email_status" varchar(20) DEFAULT 'pending' NOT NULL,
  "email_sent_at" timestamp with time zone,
  "email_error" text,
  "ip_address" varchar(45),
  "user_agent" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "contact_requests_created_at_idx"
  ON "contact_requests" ("created_at");

CREATE INDEX IF NOT EXISTS "contact_requests_email_status_idx"
  ON "contact_requests" ("email_status");

CREATE INDEX IF NOT EXISTS "contact_requests_website_interest_idx"
  ON "contact_requests" ("website_interest");
