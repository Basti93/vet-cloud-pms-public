import {
  pgTable,
  text,
  timestamp,
  uuid,
  boolean,
  integer,
  jsonb,
  varchar,
  smallint,
  index,
  foreignKey,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// ============================================================================
// TENANTS (Multi-Tenancy Foundation)
// ============================================================================

export const tenants = pgTable(
  "tenants",
  {
    id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    slug: varchar("slug", { length: 100 }).notNull().unique(),
    email: varchar("email", { length: 255 }).notNull(),
    phone: varchar("phone", { length: 20 }),
    website: varchar("website", { length: 255 }),
    address: text("address"),
    city: varchar("city", { length: 100 }),
    postalCode: varchar("postal_code", { length: 20 }),
    country: varchar("country", { length: 2 }).default("DE"),
    subscriptionStatus: varchar("subscription_status", {
      length: 50,
      enum: ["trial", "active", "paused", "cancelled"],
    })
      .default("trial")
      .notNull(),
    subscriptionPlan: varchar("subscription_plan", {
      length: 50,
      enum: ["free", "starter", "pro", "enterprise"],
    })
      .default("starter")
      .notNull(),
    maxUsers: smallint("max_users").default(5),
    createdAt: timestamp("created_at", { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
  },
  (table) => ({
    slugIdx: index("tenants_slug_idx").on(table.slug),
  })
);

// ============================================================================
// USERS (with Clerk Integration)
// ============================================================================

export const users = pgTable(
  "users",
  {
    id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    clerkId: varchar("clerk_id", { length: 255 }).notNull().unique(),
    email: varchar("email", { length: 255 }).notNull(),
    firstName: varchar("first_name", { length: 100 }),
    lastName: varchar("last_name", { length: 100 }),
    role: varchar("role", {
      length: 50,
      enum: ["admin", "vet", "staff", "reception"],
    })
      .default("staff")
      .notNull(),
    active: boolean("active").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
  },
  (table) => ({
    tenantIdIdx: index("users_tenant_id_idx").on(table.tenantId),
    clerkIdIdx: index("users_clerk_id_idx").on(table.clerkId),
  })
);

// ============================================================================
// OWNERS (Tierhaltende Personen)
// ============================================================================

export const owners = pgTable(
  "owners",
  {
    id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    firstName: varchar("first_name", { length: 100 }).notNull(),
    lastName: varchar("last_name", { length: 100 }).notNull(),
    email: varchar("email", { length: 255 }),
    phone: varchar("phone", { length: 20 }),
    address: text("address"),
    city: varchar("city", { length: 100 }),
    postalCode: varchar("postal_code", { length: 20 }),
    country: varchar("country", { length: 2 }).default("DE"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
  },
  (table) => ({
    tenantIdIdx: index("owners_tenant_id_idx").on(table.tenantId),
    emailIdx: index("owners_email_idx").on(table.email),
  })
);

// ============================================================================
// PATIENTS (Tiere)
// ============================================================================

export const patients = pgTable(
  "patients",
  {
    id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => owners.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 100 }).notNull(),
    species: varchar("species", { length: 50 }).notNull(), // "Hund", "Katze", etc.
    breed: varchar("breed", { length: 100 }),
    birthDate: timestamp("birth_date", { withTimezone: true }),
    microchipId: varchar("microchip_id", { length: 50 }),
    weight: integer("weight"), // in Gramm
    color: varchar("color", { length: 100 }),
    notes: text("notes"),
    active: boolean("active").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
  },
  (table) => ({
    tenantIdIdx: index("patients_tenant_id_idx").on(table.tenantId),
    ownerIdIdx: index("patients_owner_id_idx").on(table.ownerId),
  })
);

// ============================================================================
// APPOINTMENTS (Termine)
// ============================================================================

export const appointments = pgTable(
  "appointments",
  {
    id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patients.id, { onDelete: "cascade" }),
    vetId: uuid("vet_id")
      .notNull()
      .references(() => users.id, { onDelete: "set null" }),
    startTime: timestamp("start_time", { withTimezone: true }).notNull(),
    endTime: timestamp("end_time", { withTimezone: true }).notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description"),
    status: varchar("status", {
      length: 50,
      enum: ["scheduled", "completed", "cancelled", "no-show"],
    })
      .default("scheduled")
      .notNull(),
    source: varchar("source", {
      length: 50,
      enum: ["manual", "voice_ai", "online_booking", "import"],
    })
      .default("manual")
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
  },
  (table) => ({
    tenantIdIdx: index("appointments_tenant_id_idx").on(table.tenantId),
    patientIdIdx: index("appointments_patient_id_idx").on(table.patientId),
    vetIdIdx: index("appointments_vet_id_idx").on(table.vetId),
    startTimeIdx: index("appointments_start_time_idx").on(table.startTime),
  })
);

// ============================================================================
// VOICE_CALLS (Vapi AI Integration)
// ============================================================================

export const voiceCalls = pgTable(
  "voice_calls",
  {
    id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    vapiCallId: varchar("vapi_call_id", { length: 255 }).notNull().unique(),
    phoneNumber: varchar("phone_number", { length: 20 }).notNull(),
    duration: integer("duration"), // in seconds
    transcription: text("transcription"),
    extractedAppointmentData: jsonb("extracted_appointment_data"), // Was hat die AI gehört?
    createdAppointmentId: uuid("created_appointment_id").references(
      () => appointments.id,
      { onDelete: "set null" }
    ),
    status: varchar("status", {
      length: 50,
      enum: ["initiated", "ringing", "active", "completed", "failed"],
    })
      .default("initiated")
      .notNull(),
    recordingUrl: varchar("recording_url", { length: 500 }),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
  },
  (table) => ({
    tenantIdIdx: index("voice_calls_tenant_id_idx").on(table.tenantId),
    vapiIdIdx: index("voice_calls_vapi_id_idx").on(table.vapiCallId),
  })
);

// ============================================================================
// AUDIT_LOG (DSGVO Compliance)
// ============================================================================

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    action: varchar("action", { length: 100 }).notNull(), // "create", "update", "delete", "export", "access"
    entityType: varchar("entity_type", { length: 100 }).notNull(), // "patient", "appointment", "owner"
    entityId: uuid("entity_id").notNull(),
    changes: jsonb("changes"), // Was hat sich geändert?
    ipAddress: varchar("ip_address", { length: 50 }),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
  },
  (table) => ({
    tenantIdIdx: index("audit_logs_tenant_id_idx").on(table.tenantId),
    userIdIdx: index("audit_logs_user_id_idx").on(table.userId),
    createdAtIdx: index("audit_logs_created_at_idx").on(table.createdAt),
  })
);

// ============================================================================
// RLS Policies (für später, muss in Postgres direkt gesetzt werden)
// ============================================================================

/*
  Nach Deployment: Diese SQL-Queries in Neon ausführen:

  -- Enable RLS on all tables
  ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
  ALTER TABLE users ENABLE ROW LEVEL SECURITY;
  ALTER TABLE owners ENABLE ROW LEVEL SECURITY;
  ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
  ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
  ALTER TABLE voice_calls ENABLE ROW LEVEL SECURITY;
  ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

  -- Beispiel RLS Policy (später):
  CREATE POLICY "Users can only access their tenant's data"
  ON patients
  FOR ALL
  USING (
    auth.jwt() ->> 'sub' = (
      SELECT clerk_id FROM users WHERE tenant_id = patients.tenant_id
    )
  );
*/
