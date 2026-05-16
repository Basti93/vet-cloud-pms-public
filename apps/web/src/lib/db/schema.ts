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
  date,
  index,
  primaryKey,
  unique,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// ============================================================================
// PERMISSIONS (App-defined constants, not in DB)
// ============================================================================

export const PERMISSIONS = {
  MEDICAL_READ: "medical:read",
  MEDICAL_CREATE: "medical:create",
  MEDICAL_UPDATE: "medical:update",

  APPOINTMENTS_READ: "appointments:read",
  APPOINTMENTS_CREATE: "appointments:create",
  APPOINTMENTS_UPDATE: "appointments:update",
  APPOINTMENTS_CANCEL: "appointments:cancel",

  PATIENTS_READ: "patients:read",
  PATIENTS_CREATE: "patients:create",
  PATIENTS_UPDATE: "patients:update",

  REPORTS_READ: "reports:read",
  REPORTS_EXPORT: "reports:export",

  SCHEDULE_MANAGE: "schedule:manage",

  USERS_MANAGE: "users:manage",
  ROLES_MANAGE: "roles:manage",
  SETTINGS_MANAGE: "settings:manage",
  WEBSITE_MANAGE: "website:manage",
  WEBSITE_PUBLISH: "website:publish",
  WEBSITE_DOMAINS: "website:domains",
  WEBSITE_MEDIA: "website:media",
} as const;

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
    tagline: varchar("tagline", { length: 255 }),
    monogram: varchar("monogram", { length: 3 }),
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
    stripeCustomerId: varchar("stripe_customer_id", { length: 255 }),
    stripeSubscriptionId: varchar("stripe_subscription_id", { length: 255 }),
    currentStripePriceId: varchar("current_stripe_price_id", { length: 255 }),
    trialEndsAt: timestamp("trial_ends_at", { withTimezone: true }),
    deactivatedAt: timestamp("deactivated_at", { withTimezone: true }),
    lastPaymentFailedAt: timestamp("last_payment_failed_at", { withTimezone: true }),
    cancelledAtPeriodEnd: timestamp("cancelled_at_period_end", { withTimezone: true }),
    paymentFailureCount: smallint("payment_failure_count").default(0),
    paymentGracePeriodEndsAt: timestamp("payment_grace_period_ends_at", { withTimezone: true }),
    trialDaysUsed: smallint("trial_days_used").default(0),
    originalTrialEndsAt: timestamp("original_trial_ends_at", { withTimezone: true }),
    themePreference: varchar("theme_preference", {
      length: 50,
      enum: ["sage", "warmsand", "klinikblau", "bordeaux", "forest", "schiefer"],
    })
      .default("sage")
      .notNull(),
    typographyPreference: varchar("typography_preference", {
      length: 50,
      enum: ["modern", "klassisch", "klinisch", "freundlich"],
    })
      .default("modern")
      .notNull(),
    customWebsiteCode: text("custom_website_code"),
    timezone: varchar("timezone", { length: 64 }).default("Europe/Berlin").notNull(),
    // Opening hours: array of 7 entries (index 0=Sun … 6=Sat)
    // Each: { dayOfWeek: number, slots: [{ startHour, startMin, endHour, endMin }] }
    openingHours: jsonb("opening_hours"),
    // Consultation hours: bookable appointment windows used by the booking widget.
    consultationHours: jsonb("consultation_hours"),
    // Special opening hours / vacation periods shown on generated websites.
    // Example: [{ id, title, startsOn, endsOn, rows: [{ days, time }], note }]
    specialOpeningHours: jsonb("special_opening_hours"),
    // Allowed domains for embedding the booking widget (array of domain strings)
    allowedEmbeddingDomains: jsonb("allowed_embedding_domains"),
    websiteEnabled: boolean("website_enabled").default(false).notNull(),
    previewToken: varchar("preview_token", { length: 64 }),
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

export const tenantWebsiteContactRequests = pgTable(
  "tenant_website_contact_requests",
  {
    id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 120 }).notNull(),
    email: varchar("email", { length: 180 }).notNull(),
    phone: varchar("phone", { length: 80 }),
    message: text("message").notNull(),
    emailStatus: varchar("email_status", {
      length: 20,
      enum: ["pending", "sent", "failed"],
    })
      .default("pending")
      .notNull(),
    emailSentAt: timestamp("email_sent_at", { withTimezone: true }),
    emailError: text("email_error"),
    ipAddress: varchar("ip_address", { length: 45 }),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
  },
  (table) => ({
    tenantIdIdx: index("tenant_website_contact_requests_tenant_id_idx").on(table.tenantId),
    createdAtIdx: index("tenant_website_contact_requests_created_at_idx").on(table.createdAt),
    emailStatusIdx: index("tenant_website_contact_requests_email_status_idx").on(table.emailStatus),
  })
);

// ============================================================================
// USERS (with Clerk Integration)
// ============================================================================

// Forward declaration for circular reference
export const roles = pgTable(
  "roles",
  {
    id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 100 }).notNull(),
    code: varchar("code", { length: 50 }).notNull(),
    description: text("description"),
    isSystem: boolean("is_system").default(false),
    isEditableByTenant: boolean("is_editable_by_tenant").default(false).notNull(),
    baseVersion: integer("base_version").default(1).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
  },
  (table) => ({
    tenantNameIdx: unique("roles_tenant_name_idx").on(
      table.tenantId,
      table.name
    ),
    tenantCodeIdx: unique("roles_tenant_code_idx").on(
      table.tenantId,
      table.code
    ),
    tenantIdIdx: index("roles_tenant_id_idx").on(table.tenantId),
  })
);

export const rolePermissions = pgTable(
  "role_permissions",
  {
    roleId: uuid("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
    permission: varchar("permission", { length: 100 }).notNull(),
  },
  (table) => ({
    pk: primaryKey(table.roleId, table.permission),
    roleIdIdx: index("role_permissions_role_id_idx").on(table.roleId),
  })
);

export const users = pgTable(
  "users",
  {
    id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    clerkId: varchar("clerk_id", { length: 255 }).notNull().unique(),
    email: varchar("email", { length: 255 }).notNull(),
    title: varchar("title", { length: 50 }), // "Dr.", "Prof.", "Dr. med.", etc.
    firstName: varchar("first_name", { length: 100 }),
    lastName: varchar("last_name", { length: 100 }),
    active: boolean("active").default(true).notNull(),
    slotDurationMin: integer("slot_duration_min").default(30).notNull(),
    locale: varchar("locale", { length: 10 }).default("de").notNull(),
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
// USER ROLES (Many-to-Many: Users ↔ Roles)
// ============================================================================

export const userRoles = pgTable(
  "user_roles",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    roleId: uuid("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
    assignedAt: timestamp("assigned_at", { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
    assignedBy: uuid("assigned_by").references(() => users.id, {
      onDelete: "set null",
    }), // Who assigned this role (for audit trail)
  },
  (table) => ({
    pk: primaryKey(table.userId, table.roleId),
    userIdIdx: index("user_roles_user_id_idx").on(table.userId),
    roleIdIdx: index("user_roles_role_id_idx").on(table.roleId),
    assignedByIdx: index("user_roles_assigned_by_idx").on(table.assignedBy),
  })
);

// ============================================================================
// WEBSITE PLATFORM V2 (Thin PMS-aware website platform)
// ============================================================================

export const standaloneAccounts = pgTable(
  "standalone_accounts",
  {
    id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    email: varchar("email", { length: 255 }).notNull(),
    billingRef: varchar("billing_ref", { length: 255 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
  },
  (table) => ({
    emailIdx: index("standalone_accounts_email_idx").on(table.email),
  })
);

export const websiteProjects = pgTable(
  "website_projects",
  {
    id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
    ownerType: varchar("owner_type", { length: 20, enum: ["tenant", "standalone"] }).notNull(),
    ownerTenantId: uuid("owner_tenant_id").references(() => tenants.id, { onDelete: "cascade" }),
    ownerStandaloneId: uuid("owner_standalone_id").references(() => standaloneAccounts.id, {
      onDelete: "cascade",
    }),
    name: varchar("name", { length: 255 }).notNull(),
    slug: varchar("slug", { length: 120 }).notNull(),
    status: varchar("status", { length: 20, enum: ["draft", "published", "archived"] })
      .default("draft")
      .notNull(),
    primaryDomain: varchar("primary_domain", { length: 255 }),
    layoutKey: varchar("layout_key", { length: 80 }).default("praxis-classic").notNull(),
    layoutVersion: integer("layout_version").default(1).notNull(),
    themeConfig: jsonb("theme_config"),
    capabilities: jsonb("capabilities").default(sql`'{}'::jsonb`).notNull(),
    seoConfig: jsonb("seo_config"),
    logoAsset: jsonb("logo_asset"),
    customCss: text("custom_css"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
  },
  (table) => ({
    slugIdx: unique("website_projects_slug_idx").on(table.slug),
    ownerTenantUniqueIdx: unique("website_projects_owner_tenant_unique_idx").on(table.ownerTenantId),
    ownerStandaloneIdx: index("website_projects_owner_standalone_idx").on(table.ownerStandaloneId),
    statusIdx: index("website_projects_status_idx").on(table.status),
  })
);

export const websitePages = pgTable(
  "website_pages",
  {
    id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
    websiteProjectId: uuid("website_project_id")
      .notNull()
      .references(() => websiteProjects.id, { onDelete: "cascade" }),
    path: varchar("path", { length: 255 }).notNull(),
    pageType: varchar("page_type", {
      length: 30,
      enum: ["default", "legal_impressum", "legal_privacy", "landing", "booking"],
    })
      .default("default")
      .notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    isHomepage: boolean("is_homepage").default(false).notNull(),
    seoConfig: jsonb("seo_config"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
  },
  (table) => ({
    projectPathIdx: unique("website_pages_project_path_idx").on(table.websiteProjectId, table.path),
    projectIdx: index("website_pages_project_idx").on(table.websiteProjectId),
    homepageIdx: index("website_pages_homepage_idx").on(table.websiteProjectId, table.isHomepage),
  })
);

export const websitePageRevisions = pgTable(
  "website_page_revisions",
  {
    id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
    websitePageId: uuid("website_page_id")
      .notNull()
      .references(() => websitePages.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    state: varchar("state", { length: 20, enum: ["draft", "published"] }).default("draft").notNull(),
    blocks: jsonb("blocks").default(sql`'[]'::jsonb`).notNull(),
    createdByUserId: uuid("created_by_user_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
  },
  (table) => ({
    pageVersionIdx: unique("website_page_revisions_page_version_idx").on(
      table.websitePageId,
      table.version
    ),
    pageStateIdx: index("website_page_revisions_page_state_idx").on(
      table.websitePageId,
      table.state,
      table.createdAt
    ),
  })
);

export const websiteDomains = pgTable(
  "website_domains",
  {
    id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
    websiteProjectId: uuid("website_project_id")
      .notNull()
      .references(() => websiteProjects.id, { onDelete: "cascade" }),
    domain: varchar("domain", { length: 255 }).notNull(),
    type: varchar("type", { length: 20, enum: ["primary", "alias"] }).default("alias").notNull(),
    status: varchar("status", {
      length: 30,
      enum: ["pending", "verification_required", "verified", "active", "failed"],
    })
      .default("pending")
      .notNull(),
    verificationMethod: varchar("verification_method", {
      length: 20,
      enum: ["txt", "cname", "http"],
    }).default("txt"),
    verificationToken: varchar("verification_token", { length: 255 }),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    lastCheckedAt: timestamp("last_checked_at", { withTimezone: true }),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
  },
  (table) => ({
    domainIdx: unique("website_domains_domain_idx").on(table.domain),
    projectIdx: index("website_domains_project_idx").on(table.websiteProjectId),
    statusIdx: index("website_domains_status_idx").on(table.status),
  })
);

export const websiteAssets = pgTable(
  "website_assets",
  {
    id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
    websiteProjectId: uuid("website_project_id")
      .notNull()
      .references(() => websiteProjects.id, { onDelete: "cascade" }),
    storageKey: varchar("storage_key", { length: 500 }).notNull(),
    url: text("url").notNull(),
    mimeType: varchar("mime_type", { length: 120 }).notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    width: integer("width"),
    height: integer("height"),
    alt: text("alt"),
    focalPoint: jsonb("focal_point"),
    createdByUserId: uuid("created_by_user_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
  },
  (table) => ({
    projectIdx: index("website_assets_project_idx").on(table.websiteProjectId),
    storageKeyIdx: unique("website_assets_storage_key_idx").on(table.storageKey),
  })
);

export const websiteAssetUsages = pgTable(
  "website_asset_usages",
  {
    assetId: uuid("asset_id")
      .notNull()
      .references(() => websiteAssets.id, { onDelete: "cascade" }),
    pageId: uuid("page_id")
      .notNull()
      .references(() => websitePages.id, { onDelete: "cascade" }),
    blockId: varchar("block_id", { length: 120 }).notNull(),
    fieldPath: varchar("field_path", { length: 255 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
  },
  (table) => ({
    pk: primaryKey(table.assetId, table.pageId, table.blockId, table.fieldPath),
    assetIdx: index("website_asset_usages_asset_idx").on(table.assetId),
    pageIdx: index("website_asset_usages_page_idx").on(table.pageId),
  })
);

export const websiteLeads = pgTable(
  "website_leads",
  {
    id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
    websiteProjectId: uuid("website_project_id")
      .notNull()
      .references(() => websiteProjects.id, { onDelete: "cascade" }),
    sourcePagePath: varchar("source_page_path", { length: 255 }),
    name: varchar("name", { length: 120 }).notNull(),
    email: varchar("email", { length: 180 }).notNull(),
    phone: varchar("phone", { length: 80 }),
    message: text("message").notNull(),
    consent: boolean("consent").default(false).notNull(),
    status: varchar("status", { length: 20, enum: ["new", "contacted", "archived"] })
      .default("new")
      .notNull(),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
  },
  (table) => ({
    projectIdx: index("website_leads_project_idx").on(table.websiteProjectId),
    statusIdx: index("website_leads_status_idx").on(table.status),
    createdAtIdx: index("website_leads_created_at_idx").on(table.createdAt),
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
    emailOptOut: boolean("email_opt_out").default(false).notNull(),
    active: boolean("active").default(true).notNull(),
    provisional: boolean("provisional").default(false).notNull(),
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
    tenantEmailUniqueIdx: uniqueIndex("owners_tenant_email_unique").on(
      table.tenantId,
      sql`lower(${table.email})`
    ).where(sql`${table.email} is not null`),
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
    allergies: text("allergies"), // Komma-getrennte Liste oder JSON
    notes: text("notes"),
    active: boolean("active").default(true).notNull(),
    provisional: boolean("provisional").default(false).notNull(),
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

export const APPOINTMENT_STATUSES = [
  "scheduled",
  "confirmed",
  "completed",
  "cancelled",
  "no-show",
  "pending-confirmation",
] as const;
export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];

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
      enum: APPOINTMENT_STATUSES,
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
// DIAGNOSES (Diagnosen & Medizinische Notizen)
// ============================================================================

export const diagnoses = pgTable(
  "diagnoses",
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
    title: varchar("title", { length: 255 }).notNull(), // z.B. "Otitis Externa"
    description: text("description"), // Detaillierte Notizen
    icd10Code: varchar("icd10_code", { length: 10 }), // Medizinischer Code
    severity: varchar("severity", {
      length: 50,
      enum: ["mild", "moderate", "severe"],
    }),
    status: varchar("status", {
      length: 50,
      enum: ["active", "resolved", "monitoring"],
    })
      .default("active")
      .notNull(),
    dateOfDiagnosis: timestamp("date_of_diagnosis", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
  },
  (table) => ({
    tenantIdIdx: index("diagnoses_tenant_id_idx").on(table.tenantId),
    patientIdIdx: index("diagnoses_patient_id_idx").on(table.patientId),
    dateIdx: index("diagnoses_date_idx").on(table.dateOfDiagnosis),
  })
);

// ============================================================================
// MEDICATIONS (Medikamente & Rezepte)
// ============================================================================

export const medications = pgTable(
  "medications",
  {
    id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patients.id, { onDelete: "cascade" }),
    diagnosisId: uuid("diagnosis_id").references(() => diagnoses.id, {
      onDelete: "set null",
    }), // Optional: verknüpft mit Diagnose
    medicationName: varchar("medication_name", { length: 255 }).notNull(),
    dosage: varchar("dosage", { length: 100 }).notNull(), // z.B. "500mg"
    frequency: varchar("frequency", { length: 100 }).notNull(), // z.B. "2x täglich"
    route: varchar("route", {
      length: 50,
      enum: ["oral", "injection", "topical", "ophthalmic", "other"],
    })
      .default("oral"),
    startDate: timestamp("start_date", { withTimezone: true }).notNull(),
    endDate: timestamp("end_date", { withTimezone: true }),
    notes: text("notes"), // Spezielle Anweisungen
    prescribedBy: uuid("prescribed_by")
      .notNull()
      .references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
  },
  (table) => ({
    tenantIdIdx: index("medications_tenant_id_idx").on(table.tenantId),
    patientIdIdx: index("medications_patient_id_idx").on(table.patientId),
    diagnosisIdIdx: index("medications_diagnosis_id_idx").on(table.diagnosisId),
    prescribedByIdx: index("medications_prescribed_by_idx").on(table.prescribedBy),
  })
);

// ============================================================================
// VITALS (Vitalzeichen & Gewicht-Tracking)
// ============================================================================

export const vitals = pgTable(
  "vitals",
  {
    id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patients.id, { onDelete: "cascade" }),
    recordedBy: uuid("recorded_by")
      .notNull()
      .references(() => users.id, { onDelete: "set null" }),
    weight: integer("weight"), // in Gramm
    temperature: varchar("temperature", { length: 10 }), // z.B. "38.5°C"
    heartRate: integer("heart_rate"), // Herzfrequenz (Schläge/Min)
    respiratoryRate: integer("respiratory_rate"), // Atemfrequenz
    notes: text("notes"), // Allgemeine Bemerkungen
    recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
  },
  (table) => ({
    tenantIdIdx: index("vitals_tenant_id_idx").on(table.tenantId),
    patientIdIdx: index("vitals_patient_id_idx").on(table.patientId),
    recordedAtIdx: index("vitals_recorded_at_idx").on(table.recordedAt),
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
// VET_SCHEDULES (Vet Availability)
// ============================================================================

export const vetSchedules = pgTable(
  "vet_schedules",
  {
    id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    vetId: uuid("vet_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    dayOfWeek: smallint("day_of_week").notNull(), // 0 = Sunday, 1 = Monday, etc.
    // Array of { startHour, startMin, endHour, endMin } — empty = day off
    slots: jsonb("slots").notNull().default(sql`'[]'::jsonb`),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
  },
  (table) => ({
    tenantVetIdIdx: index("vet_schedules_tenant_vet_idx").on(
      table.tenantId,
      table.vetId
    ),
    dayIdx: index("vet_schedules_day_idx").on(table.dayOfWeek),
  })
);

// ============================================================================
// VET_ABSENCES (Urlaub, Krankmeldung, sonstige Abwesenheiten)
// ============================================================================

export const vetAbsences = pgTable(
  "vet_absences",
  {
    id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    vetId: uuid("vet_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    startDate: date("start_date").notNull(),
    endDate: date("end_date").notNull(),
    type: varchar("type", {
      length: 20,
      enum: ["vacation", "sick", "other"],
    })
      .default("vacation")
      .notNull(),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
  },
  (table) => ({
    tenantVetIdx: index("vet_absences_tenant_vet_idx").on(table.tenantId, table.vetId),
    dateRangeIdx: index("vet_absences_date_range_idx").on(table.startDate, table.endDate),
  })
);

// ============================================================================
// APPOINTMENT_HOLDS (15-Minuten Slot-Reservierungen beim Online Booking)
// ============================================================================

export const appointmentHolds = pgTable(
  "appointment_holds",
  {
    id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    slotDatetime: timestamp("slot_datetime", { withTimezone: true }).notNull(),
    vetId: uuid("vet_id").references(() => users.id, { onDelete: "cascade" }),
    browserSessionId: uuid("browser_session_id").notNull(),
    sessionToken: uuid("session_token").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
  },
  (table) => ({
    tenantSessionIdx: index("appointment_holds_tenant_session_idx").on(
      table.tenantId,
      table.browserSessionId
    ),
    tenantSlotIdx: index("appointment_holds_tenant_slot_idx").on(
      table.tenantId,
      table.slotDatetime
    ),
    expiresAtIdx: index("appointment_holds_expires_at_idx").on(table.expiresAt),
    sessionTokenIdx: index("appointment_holds_session_token_idx").on(
      table.sessionToken
    ),
  })
);

// ============================================================================
// EMAIL_SETTINGS (Notification Configuration per Tenant)
// ============================================================================

export const emailSettings = pgTable(
  "email_settings",
  {
    id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .unique()
      .references(() => tenants.id, { onDelete: "cascade" }),
    confirmationEmailEnabled: boolean("confirmation_email_enabled").default(true).notNull(),
    reminderEmailEnabled: boolean("reminder_email_enabled").default(true).notNull(),
    reminderHoursBefore: smallint("reminder_hours_before").default(24).notNull(), // 24h default
    bookingNotificationEnabled: boolean("booking_notification_enabled").default(true).notNull(),
    senderName: varchar("sender_name", { length: 100 }).default("System").notNull(),
    confirmationSubject: varchar("confirmation_subject", { length: 255 })
      .default("Bestätigung: Ihr Termin bei {practiceName}")
      .notNull(),
    confirmationBody: text("confirmation_body")
      .default("Hallo {ownerFirstName},\n\nIhr Termin für {patientName} am {appointmentDate} um {appointmentTime} wurde bestätigt.\n\nBeste Grüße,\n{practiceName}")
      .notNull(),
    reminderSubject: varchar("reminder_subject", { length: 255 })
      .default("Erinnerung: Termin morgen bei {practiceName}")
      .notNull(),
    reminderBody: text("reminder_body")
      .default("Hallo {ownerFirstName},\n\nIhr Termin für {patientName} findet morgen um {appointmentTime} statt.\n\nBeste Grüße,\n{practiceName}")
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
  },
  (table) => ({
    // tenantId has column-level .unique() which already creates an index
  })
);

// ============================================================================
// APPOINTMENT_EMAIL_LOGS (Email Delivery Tracking)
// ============================================================================

export const appointmentEmailLogs = pgTable(
  "appointment_email_logs",
  {
    id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    appointmentId: uuid("appointment_id")
      .notNull()
      .references(() => appointments.id, { onDelete: "cascade" }),
    emailType: varchar("email_type", {
      length: 50,
      enum: ["confirmation", "reminder", "booking_notification"],
    }).notNull(),
    recipientEmail: varchar("recipient_email", { length: 255 }).notNull(),
    status: varchar("status", {
      length: 50,
      enum: ["sent", "failed"],
    })
      .default("sent")
      .notNull(),
    errorMessage: text("error_message"), // If status is "failed"
    sentAt: timestamp("sent_at", { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
  },
  (table) => ({
    tenantIdIdx: index("appointment_email_logs_tenant_id_idx").on(table.tenantId),
    appointmentIdIdx: index("appointment_email_logs_appointment_id_idx").on(
      table.appointmentId
    ),
    emailTypeIdx: index("appointment_email_logs_email_type_idx").on(table.emailType),
    sentAtIdx: index("appointment_email_logs_sent_at_idx").on(table.sentAt),
  })
);

// ============================================================================
// VACCINATION TYPES (Global catalogue — STIKO Vet standard, no tenant_id)
// ============================================================================

export const vaccinationTypes = pgTable(
  "vaccination_types",
  {
    id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
    // Short machine code used in seed data ("SHP", "L4", "RCP", "Myxo")
    code: varchar("code", { length: 30 }).notNull().unique(),
    // German display name shown in the UI
    name: varchar("name", { length: 150 }).notNull(),
    // Comma-separated list of applicable species: "Hund", "Katze", "Kaninchen", etc.
    species: varchar("species", { length: 200 }).notNull(),
    // "core" | "recommended" | "non-core"
    category: varchar("category", { length: 20 }).notNull().default("recommended"),
    // Default reminder interval in months (e.g. 12 for Leptospirose, 36 for SHP)
    defaultIntervalMonths: integer("default_interval_months").notNull(),
    // For series (puppy Grundimmunisierung): how many doses needed? 1 = single shot
    seriesDoses: integer("series_doses").notNull().default(1),
    // Minimum days between doses in a series (null if no series)
    minIntervalDays: integer("min_interval_days"),
    // If true, batchNumber is required (Tollwut for EU Pet Passport)
    requiresBatchNumber: boolean("requires_batch_number").notNull().default(false),
    // Display order in form dropdown
    sortOrder: integer("sort_order").notNull().default(100),
    // Optional vet-facing note (e.g. "Bei Auslandsreise erforderlich")
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
  },
  (table) => ({
    codeIdx: index("vaccination_types_code_idx").on(table.code),
  })
);

// ============================================================================
// TENANT VACCINATION TYPE CONFIG
// Hybrid model: extends the global STIKO catalogue per tenant.
//   - Row with vaccinationTypeId + enabled=false  → hides that global type
//   - Row with vaccinationTypeId = null            → tenant-specific custom type
// ============================================================================

export const tenantVaccinationTypeConfig = pgTable(
  "tenant_vaccination_type_config",
  {
    id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    // null → custom type row; non-null → config for a global type
    vaccinationTypeId: uuid("vaccination_type_id").references(
      () => vaccinationTypes.id,
      { onDelete: "cascade" }
    ),
    // false = this global type is hidden for this tenant (ignored for custom rows)
    enabled: boolean("enabled").notNull().default(true),
    // Custom type fields — only populated when vaccinationTypeId IS NULL
    customName: varchar("custom_name", { length: 150 }),
    customSpecies: varchar("custom_species", { length: 200 }),
    customCategory: varchar("custom_category", { length: 20 }),
    customIntervalMonths: integer("custom_interval_months"),
    customRequiresBatchNumber: boolean("custom_requires_batch_number").default(false),
    customNotes: text("custom_notes"),
    // Display order in the form dropdown
    sortOrder: integer("sort_order").notNull().default(100),
    createdAt: timestamp("created_at", { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
  },
  (table) => ({
    tenantIdIdx: index("tenant_vax_type_config_tenant_id_idx").on(table.tenantId),
    // One config row per global type per tenant (NULLs are distinct → custom types allowed)
    uniquePerTenant: unique("tenant_vax_type_config_unique").on(
      table.tenantId,
      table.vaccinationTypeId
    ),
  })
);

// ============================================================================
// VACCINATIONS (Patient Vaccination Records + Reminder State)
// ============================================================================

export const vaccinations = pgTable(
  "vaccinations",
  {
    id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patients.id, { onDelete: "cascade" }),
    // Set when a global STIKO type was selected
    vaccinationTypeId: uuid("vaccination_type_id").references(
      () => vaccinationTypes.id,
      { onDelete: "set null" }
    ),
    // Set when a tenant-specific custom type was selected
    tenantVaccinationTypeConfigId: uuid("tenant_vaccination_type_config_id").references(
      () => tenantVaccinationTypeConfig.id,
      { onDelete: "set null" }
    ),
    // Display name — always populated (from type.name, custom config name, or free text)
    type: varchar("type", { length: 120 }).notNull(),
    administeredDate: timestamp("administered_date", { withTimezone: true }).notNull(),
    expiryDate: timestamp("expiry_date", { withTimezone: true }).notNull(),
    vetId: uuid("vet_id").references(() => users.id, { onDelete: "set null" }),
    batchNumber: varchar("batch_number", { length: 120 }),
    reminderSentDate: timestamp("reminder_sent_date", { withTimezone: true }),
    notes: text("notes"),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
  },
  (table) => ({
    tenantIdIdx: index("vaccinations_tenant_id_idx").on(table.tenantId),
    patientIdIdx: index("vaccinations_patient_id_idx").on(table.patientId),
    expiryDateIdx: index("vaccinations_expiry_date_idx").on(table.expiryDate),
    tenantExpiryReminderIdx: index("vaccinations_tenant_expiry_reminder_idx").on(
      table.tenantId,
      table.expiryDate,
      table.reminderSentDate
    ),
  })
);

export const vaccinationSettings = pgTable(
  "vaccination_settings",
  {
    tenantId: uuid("tenant_id")
      .notNull()
      .primaryKey()
      .references(() => tenants.id, { onDelete: "cascade" }),
    reminderEnabled: boolean("reminder_enabled").default(true).notNull(),
    reminderDaysBefore: integer("reminder_days_before").default(30).notNull(),
    // Category filters — which vaccination categories trigger a reminder
    remindCore: boolean("remind_core").default(true).notNull(),
    remindRecommended: boolean("remind_recommended").default(true).notNull(),
    remindOptional: boolean("remind_optional").default(false).notNull(),
    // Also remind if the vaccination is already overdue (expiryDate < today)
    remindOverdue: boolean("remind_overdue").default(true).notNull(),
    reminderSubject: varchar("reminder_subject", { length: 255 })
      .default("Impf-Erinnerung für {petName}")
      .notNull(),
    reminderBody: text("reminder_body")
      .default(
        "Hallo {ownerName},\n\nfür {petName} ist die Auffrischung ({vaccinationType}) am {dueDate} fällig.\nBitte vereinbaren Sie einen Termin bei {clinicName}.\n\nViele Grüße\n{clinicName}"
      )
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
  },
  (table) => ({
    // tenantId is the primaryKey — already indexed
  })
);

export const vaccinationEmailLogs = pgTable(
  "vaccination_email_logs",
  {
    id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    vaccinationId: uuid("vaccination_id")
      .notNull()
      .references(() => vaccinations.id, { onDelete: "cascade" }),
    emailAddress: varchar("email_address", { length: 255 }).notNull(),
    status: varchar("status", { length: 20, enum: ["sent", "failed", "bounced"] })
      .notNull()
      .default("sent"),
    messageId: varchar("message_id", { length: 255 }),
    error: text("error"),
    sentAt: timestamp("sent_at", { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
  },
  (table) => ({
    tenantIdIdx: index("vaccination_email_logs_tenant_id_idx").on(table.tenantId),
    vaccinationIdIdx: index("vaccination_email_logs_vaccination_id_idx").on(table.vaccinationId),
    statusSentAtIdx: index("vaccination_email_logs_status_sent_at_idx").on(table.status, table.sentAt),
  })
);

// ============================================================================
// FEATURE_FLAGS (Per-Tenant Feature Toggle)
// ============================================================================

export const featureFlags = pgTable(
  "feature_flags",
  {
    id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .unique()
      .references(() => tenants.id, { onDelete: "cascade" }),
    aiReceptionEnabled: boolean("ai_reception_enabled").default(false).notNull(), // Vapi integration
    createdAt: timestamp("created_at", { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
  },
  (table) => ({
    // tenantId has column-level .unique() which already creates an index
  })
);

// ============================================================================
// CALENDAR ACCESS & SYNC
// ============================================================================

export const calendarAccessTokens = pgTable(
  "calendar_access_tokens",
  {
    id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    vetId: uuid("vet_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    token: text("token").notNull().unique(), // UUID token for access
    isActive: boolean("is_active").default(true).notNull(),
    description: varchar("description", { length: 255 }), // "Google Calendar", "Outlook", etc
    createdAt: timestamp("created_at", { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
    createdBy: uuid("created_by"), // User ID who created this token
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }), // NULL while active
  },
  (table) => ({
    tenantVetIdx: index("calendar_tokens_tenant_vet_idx").on(table.tenantId, table.vetId),
    tenantIdIdx: index("calendar_tokens_tenant_id_idx").on(table.tenantId),
    // token has column-level .unique() — tokenUniqueIdx was a duplicate
  })
);

export const calendarAccessAudit = pgTable(
  "calendar_access_audit",
  {
    id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
    tokenId: uuid("token_id").references(() => calendarAccessTokens.id, { onDelete: "cascade" }),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    veterinarianId: uuid("veterinarian_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accessedAt: timestamp("accessed_at", { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
    ipAddress: varchar("ip_address", { length: 45 }), // IPv6 support
    userAgent: text("user_agent"),
    eventCount: integer("event_count").default(0), // Number of events in response
    httpStatus: integer("http_status"), // 200, 304, 401, etc
  },
  (table) => ({
    tenantIdIdx: index("calendar_audit_tenant_id_idx").on(table.tenantId),
    tokenIdIdx: index("calendar_audit_token_id_idx").on(table.tokenId),
    accessedAtIdx: index("calendar_audit_accessed_at_idx").on(table.accessedAt),
  })
);

export const tenantDeletionSchedules = pgTable(
  "tenant_deletion_schedules",
  {
    id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" })
      .unique(),
    requestedByUserId: uuid("requested_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    status: varchar("status", { length: 30, enum: ["scheduled", "cancelled", "executed"] })
      .default("scheduled")
      .notNull(),
    previousSubscriptionStatus: varchar("previous_subscription_status", {
      length: 20,
      enum: ["trial", "active", "paused", "cancelled"],
    }),
    reason: text("reason"),
    reactivationToken: varchar("reactivation_token", { length: 255 }),
    reactivationTokenExpiresAt: timestamp("reactivation_token_expires_at", {
      withTimezone: true,
    }),
    scheduledFor: timestamp("scheduled_for", { withTimezone: true }).notNull(),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    executedAt: timestamp("executed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
  },
  (table) => ({
    statusScheduledForIdx: index("tenant_deletion_schedules_status_scheduled_for_idx").on(
      table.status,
      table.scheduledFor
    ),
    tenantIdIdx: index("tenant_deletion_schedules_tenant_id_idx").on(table.tenantId),
    reactivationTokenIdx: index("tenant_deletion_schedules_reactivation_token_idx").on(
      table.reactivationToken
    ),
  })
);

export const userInvitations = pgTable(
  "user_invitations",
  {
    id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    email: varchar("email", { length: 255 }).notNull(),
    role: varchar("role", {
      length: 20,
      enum: ["admin", "vet", "reception"],
    }).notNull(),
    status: varchar("status", {
      length: 20,
      enum: ["pending", "accepted", "revoked", "expired"],
    })
      .default("pending")
      .notNull(),
    tokenHash: varchar("token_hash", { length: 255 }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    invitedByUserId: uuid("invited_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    acceptedByUserId: uuid("accepted_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
  },
  (table) => ({
    tenantIdIdx: index("user_invitations_tenant_id_idx").on(table.tenantId),
    tenantEmailIdx: index("user_invitations_tenant_email_idx").on(table.tenantId, table.email),
    statusExpiresIdx: index("user_invitations_status_expires_idx").on(table.status, table.expiresAt),
    tokenHashIdx: unique("user_invitations_token_hash_unique").on(table.tokenHash),
  })
);

// ============================================================================
// CONTACT REQUESTS (Landing page consultation requests)
// ============================================================================

export const contactRequests = pgTable(
  "contact_requests",
  {
    id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
    name: varchar("name", { length: 120 }).notNull(),
    email: varchar("email", { length: 180 }).notNull(),
    phone: varchar("phone", { length: 80 }),
    practiceName: varchar("practice_name", { length: 160 }),
    role: varchar("role", { length: 120 }),
    websiteInterest: boolean("website_interest").default(false).notNull(),
    message: text("message"),
    emailStatus: varchar("email_status", {
      length: 20,
      enum: ["pending", "sent", "failed"],
    })
      .default("pending")
      .notNull(),
    emailSentAt: timestamp("email_sent_at", { withTimezone: true }),
    emailError: text("email_error"),
    ipAddress: varchar("ip_address", { length: 45 }),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
  },
  (table) => ({
    createdAtIdx: index("contact_requests_created_at_idx").on(table.createdAt),
    emailStatusIdx: index("contact_requests_email_status_idx").on(table.emailStatus),
    websiteInterestIdx: index("contact_requests_website_interest_idx").on(
      table.websiteInterest
    ),
  })
);

// ============================================================================
// SYSTEM LOGGING (Admin Dashboard, Error Tracking)
// ============================================================================

export const systemLogs = pgTable(
  "system_logs",
  {
    id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
    timestamp: timestamp("timestamp", { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
    tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "set null" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    level: varchar("level", {
      length: 20,
      enum: ["debug", "info", "warn", "error", "critical"],
    })
      .default("info")
      .notNull(),
    category: varchar("category", { length: 50 }), // api, auth, email, booking, etc
    eventType: varchar("event_type", { length: 100 }), // request_failed, slow_request, email_send_failed, etc
    message: text("message").notNull(),
    metadata: jsonb("metadata"), // { path, durationMs, input, statusCode, etc }
    errorStack: text("error_stack"),
    ipAddress: varchar("ip_address", { length: 45 }), // IPv4 or IPv6
    correlationId: varchar("correlation_id", { length: 100 }), // Track related logs
    createdAt: timestamp("created_at", { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
  },
  (table) => ({
    timestampIdx: index("system_logs_timestamp_idx").on(table.timestamp),
    tenantTimestampIdx: index("system_logs_tenant_timestamp_idx").on(table.tenantId, table.timestamp),
    levelIdx: index("system_logs_level_idx").on(table.level),
    correlationIdIdx: index("system_logs_correlation_id_idx").on(table.correlationId),
  })
);

// ============================================================================
// RLS Policies (für später, muss in Postgres direkt gesetzt werden)
// ============================================================================

/*
  Nach Deployment: Diese SQL-Queries direkt in PostgreSQL ausführen (Hetzner/Coolify):

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
