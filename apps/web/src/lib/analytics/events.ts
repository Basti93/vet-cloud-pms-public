export const AnalyticsEvents = {
  LANDING_CTA_CLICK: "landing_cta_click",
  CONTACT_FORM_SUBMITTED: "contact_form_submitted",
  CONTACT_FORM_SUCCESS: "contact_form_success",
  SIGNUP_STARTED: "signup_started",
  SIGNUP_COMPLETED: "signup_completed",
  ONBOARDING_COMPLETED: "onboarding_completed",

  BOOKING_STARTED: "booking_started",
  BOOKING_VET_SELECTED: "booking_vet_selected",
  BOOKING_SLOT_SELECTED: "booking_slot_selected",
  BOOKING_DETAILS_ENTERED: "booking_details_entered",
  BOOKING_CONFIRMED: "booking_confirmed",
  BOOKING_ABANDONED: "booking_abandoned",

  SUBSCRIPTION_CHECKOUT_STARTED: "subscription_checkout_started",
  SUBSCRIPTION_CHECKOUT_RETURNED: "subscription_checkout_returned",
  SUBSCRIPTION_ACTIVATED: "subscription_activated",
  SUBSCRIPTION_PLAN_CHANGED: "subscription_plan_changed",
  SUBSCRIPTION_CANCELLED: "subscription_cancelled",
  SUBSCRIPTION_CANCEL_UNDONE: "subscription_cancel_undone",
  SUBSCRIPTION_REACTIVATED: "subscription_reactivated",
  DATA_EXPORTED: "data_exported",
  ACCOUNT_DELETION_REQUESTED: "account_deletion_requested",

  FEATURE_USED: "feature_used",
  FIRST_APPOINTMENT_CREATED: "first_appointment_created",
  VOICE_AI_USED: "voice_ai_used",
  TEAM_INVITE_SENT: "team_invite_sent",
  MEDICAL_RECORD_CREATED: "medical_record_created",

  ADMIN_PAGE_VIEWED: "admin_page_viewed",
} as const;

export type AnalyticsEvent = (typeof AnalyticsEvents)[keyof typeof AnalyticsEvents];

export const FeatureNames = {
  CALENDAR: "calendar",
  APPOINTMENTS: "appointments",
  PATIENTS: "patients",
  VACCINATIONS: "vaccinations",
  STATISTICS: "statistics",
  VOICE: "voice",
  BOOKINGS: "bookings",
  SETTINGS: "settings",
  TEAM: "team",
} as const;

export type FeatureName = (typeof FeatureNames)[keyof typeof FeatureNames];