/**
 * Test Data Definition — Single Source of Truth
 * Used by demo-reset.ts (demo tenant lifecycle)
 *
 * Keep this file as the authoritative source for all test data.
 * Changes here automatically apply to demo reseeding/reset.
 */

export const DEMO_TENANT_ID = "00000000-0000-4000-8000-000000000003";
export const DEMO_TENANT_SLUG = "demo";

// ── E2E tenant ─────────────────────────────────────────────────────────────
// Separate from demo — never shared, reset before each CI run.
// Clerk user: user@example.com (user_placeholder)
export const E2E_TENANT_ID = "00000000-0000-4000-8000-000000000004";
export const E2E_TENANT_SLUG = "REDACTED";
export const E2E_CLERK_USER_ID = "user_placeholder";

export const TEST_DATA = {
  // ────────────────────────────────────────────────────────────────────────
  // TENANT
  // ────────────────────────────────────────────────────────────────────────
  tenant: {
    id: DEMO_TENANT_ID,
    name: "Tierarztpraxis Demo",
    slug: DEMO_TENANT_SLUG,
    email: "user+demo-praxis@example.com",
    phone: "+49 30 123456",
    address: "Schönhauser Allee 42",
    city: "Berlin",
    postalCode: "10435",
    country: "DE",
    tagline: "Ihre Tierarztpraxis in Berlin-Prenzlauer Berg",
    monogram: "TP",
    themePreference: "sage" as const,
    typographyPreference: "modern" as const,
    websiteTemplate: "klassik" as const,
    openingHours: [
      { dayOfWeek: 0, slots: [] },
      { dayOfWeek: 1, slots: [{ startHour: 9, startMin: 0, endHour: 11, endMin: 30 }, { startHour: 16, startMin: 0, endHour: 19, endMin: 0 }] },
      { dayOfWeek: 2, slots: [{ startHour: 15, startMin: 0, endHour: 18, endMin: 0 }] },
      { dayOfWeek: 3, slots: [{ startHour: 9, startMin: 0, endHour: 11, endMin: 30 }, { startHour: 16, startMin: 0, endHour: 19, endMin: 0 }] },
      { dayOfWeek: 4, slots: [{ startHour: 9, startMin: 0, endHour: 11, endMin: 30 }, { startHour: 16, startMin: 0, endHour: 19, endMin: 0 }] },
      { dayOfWeek: 5, slots: [{ startHour: 9, startMin: 0, endHour: 12, endMin: 0 }] },
      { dayOfWeek: 6, slots: [] },
    ],
    subscriptionStatus: "trial" as const,
    subscriptionPlan: "starter" as const,
    maxUsers: 5,
    stripeCustomerId: "cus_UUpHoyFjgB9Fxe",
    stripeSubscriptionId: "sub_1TVprpFry6Q2J6YWKur8fIbo",
    currentStripePriceId: "price_1TVoO7Fry6Q2J6YWKYI1bQCS",
    trialEndsAt: null as Date | null,
    cancelledAtPeriodEnd: null as Date | null,
    paymentFailureCount: 0,
    paymentGracePeriodEndsAt: null as Date | null,
    lastPaymentFailedAt: null as Date | null,
    deactivatedAt: null as Date | null,
    trialDaysUsed: 0,
    originalTrialEndsAt: null as Date | null,
  },

  // ────────────────────────────────────────────────────────────────────────
  // USERS
  // ────────────────────────────────────────────────────────────────────────
  users: [
    {
      clerkId: "user_demo_admin_001",
      tenantId: DEMO_TENANT_ID,
      email: "user+demo-admin@example.com",
      firstName: "Admin",
      lastName: "User",
      role: "admin" as const,
      additionalRoles: ["vet"] as const,
    },
    {
      clerkId: "user_demo_vet_001",
      tenantId: DEMO_TENANT_ID,
      email: "user+demo-vet1@example.com",
      title: "Dr.",
      firstName: "Max",
      lastName: "Mueller",
      role: "vet" as const,
    },
    {
      clerkId: "user_demo_vet_002",
      tenantId: DEMO_TENANT_ID,
      email: "user+demo-vet2@example.com",
      title: "Dr.",
      firstName: "Sarah",
      lastName: "Schmidt",
      role: "vet" as const,
    },
    {
      clerkId: "user_demo_vet_003",
      tenantId: DEMO_TENANT_ID,
      email: "user+demo-vet3@example.com",
      title: "Dr. med. vet.",
      firstName: "Alexander",
      lastName: "Weber",
      role: "vet" as const,
    },
  ],

  // ────────────────────────────────────────────────────────────────────────
  // OWNERS
  // ────────────────────────────────────────────────────────────────────────
  owners: [
    {
      firstName: "Max",
      lastName: "Mustermann",
      email: "user+demo-owner1@example.com",
      phone: "+49 123 111111",
      address: "Beispielstraße 1",
      city: "Berlin",
      postalCode: "10115",
      country: "DE",
    },
    {
      firstName: "Erika",
      lastName: "Beispiel",
      email: "user+demo-owner2@example.com",
      phone: "+49 123 222222",
      address: "Beispielstraße 1",
      city: "Musterstadt",
      postalCode: "80331",
      country: "DE",
    },
    {
      firstName: "Thomas",
      lastName: "Test",
      email: "user+demo-owner3@example.com",
      phone: "+49 123 333333",
      address: "Beispielstraße 1",
      city: "Hamburg",
      postalCode: "20095",
      country: "DE",
    },
    {
      firstName: "Julia",
      lastName: "Fischer",
      email: "user+demo-owner4@example.com",
      phone: "+49 123 444444",
      address: "Beispielstraße 1",
      city: "Köln",
      postalCode: "50667",
      country: "DE",
    },
  ],

  // ────────────────────────────────────────────────────────────────────────
  // PATIENTS (indexed by ownerIndex)
  // ────────────────────────────────────────────────────────────────────────
  patients: [
    {
      ownerIndex: 0,
      name: "Bella",
      species: "Hund",
      breed: "Golden Retriever",
      color: "Gold",
      weight: 32000, // grams
    },
    {
      ownerIndex: 0,
      name: "Milo",
      species: "Katze",
      breed: "Britisch Kurzhaar",
      color: "Grau",
      weight: 4500,
    },
    {
      ownerIndex: 1,
      name: "Luna",
      species: "Hund",
      breed: "Husky",
      color: "Weiß/Grau",
      weight: 28000,
    },
    {
      ownerIndex: 2,
      name: "Whiskers",
      species: "Kaninchen",
      breed: "Widder",
      color: "Braun",
      weight: 2000,
    },
    {
      ownerIndex: 2,
      name: "Rex",
      species: "Hund",
      breed: "Deutscher Schäferhund",
      color: "Braun-Schwarz",
      weight: 38000,
    },
    {
      ownerIndex: 3,
      name: "Tweety",
      species: "Vogel",
      breed: "Wellensittich",
      color: "Blau",
      weight: 35,
    },
  ],

  // ────────────────────────────────────────────────────────────────────────
  // DIAGNOSES (indexed by patientIndex)
  // ────────────────────────────────────────────────────────────────────────
  diagnoses: [
    {
      patientIndex: 0, // Bella
      title: "Otitis Externa",
      description: "Entzündung des äußeren Gehörgangs",
      severity: "mild" as const,
      status: "active" as const,
    },
    {
      patientIndex: 1, // Milo
      title: "Zahnstein",
      description: "Zahnsteinbildung, Zahnreinigung empfohlen",
      severity: "moderate" as const,
      status: "monitoring" as const,
    },
    {
      patientIndex: 2, // Luna
      title: "Allergische Dermatitis",
      description: "Hautallergien, wahrscheinlich Futterallergie",
      severity: "moderate" as const,
      status: "active" as const,
    },
  ],

  // ────────────────────────────────────────────────────────────────────────
  // MEDICATIONS (indexed by patientIndex & diagnosisIndex)
  // ────────────────────────────────────────────────────────────────────────
  medications: [
    {
      patientIndex: 0, // Bella
      diagnosisIndex: 0, // Otitis
      medicationName: "Ofloxacin Ohrentropfen",
      dosage: "3 Tropfen",
      frequency: "2x täglich",
      route: "ophthalmic" as const,
      notes: "Vor Anwendung erwärmen",
    },
    {
      patientIndex: 1, // Milo
      diagnosisIndex: null,
      medicationName: "Hill's t/d Zahnpflegefutter",
      dosage: "120g",
      frequency: "1x täglich",
      route: "oral" as const,
      notes: "Zahnreinigung fördernd",
    },
    {
      patientIndex: 2, // Luna
      diagnosisIndex: 2, // Allergische Dermatitis
      medicationName: "Apoquel",
      dosage: "16mg",
      frequency: "1x täglich",
      route: "oral" as const,
      notes: "Bei Juckreiz",
    },
  ],

  // ────────────────────────────────────────────────────────────────────────
  // VITALS (indexed by patientIndex)
  // ────────────────────────────────────────────────────────────────────────
  vitals: [
    {
      patientIndex: 0, // Bella
      weight: 32000,
      temperature: "38.5°C",
      heartRate: 85,
      respiratoryRate: 22,
      notes: "Normal",
      daysAgo: 2,
    },
    {
      patientIndex: 1, // Milo
      weight: 4500,
      temperature: "38.2°C",
      heartRate: 120,
      respiratoryRate: 28,
      notes: "Katze ruhig",
      daysAgo: 2,
    },
    {
      patientIndex: 2, // Luna
      weight: 28000,
      temperature: "38.7°C",
      heartRate: 90,
      respiratoryRate: 24,
      notes: "Stabil",
      daysAgo: 1,
    },
  ],

  // ────────────────────────────────────────────────────────────────────────
  // INTERNAL APPOINTMENTS (manual)
  // vetIndex: 1=Mueller, 2=Schmidt, 3=Weber
  // ────────────────────────────────────────────────────────────────────────
  internalAppointments: [
    // Past (completed) - distributed across all vets
    {
      patientIndex: 0,
      vetIndex: 0, // Mueller
      title: "Routineuntersuchung",
      description: "Demo appointment",
      daysFromNow: -7,
      hour: 9,
      status: "completed" as const,
    },
    {
      patientIndex: 1,
      vetIndex: 1, // Schmidt
      title: "Zahnreinigung",
      description: "Demo appointment",
      daysFromNow: -6,
      hour: 10,
      status: "completed" as const,
    },
    {
      patientIndex: 2,
      vetIndex: 2, // Weber
      title: "Impfung (Tollwut)",
      description: "Demo appointment",
      daysFromNow: -5,
      hour: 11,
      status: "completed" as const,
    },
    {
      patientIndex: 3,
      vetIndex: 1, // Mueller
      title: "Parasitenkontrolle",
      description: "Demo appointment",
      daysFromNow: -4,
      hour: 14,
      status: "completed" as const,
    },
    // No-show
    {
      patientIndex: 4,
      vetIndex: 1, // Schmidt
      title: "Untersuchung",
      description: "Demo appointment",
      daysFromNow: -3,
      hour: 9,
      status: "no-show" as const,
    },
    // Cancelled
    {
      patientIndex: 5,
      vetIndex: 2, // Weber
      title: "Gesundheitscheck",
      description: "Demo appointment",
      daysFromNow: -2,
      hour: 10,
      status: "cancelled" as const,
    },
    // Future (scheduled) - distributed across all vets with plenty of free slots
    {
      patientIndex: 0,
      vetIndex: 1, // Schmidt
      title: "Nachuntersuchung",
      description: "Demo appointment",
      daysFromNow: 1,
      hour: 10,
      status: "scheduled" as const,
    },
    {
      patientIndex: 2,
      vetIndex: 2, // Weber
      title: "Impfauffrischung",
      description: "Demo appointment",
      daysFromNow: 2,
      hour: 12,
      status: "scheduled" as const,
    },
    {
      patientIndex: 1,
      vetIndex: 1, // Mueller
      title: "Routine Checkup",
      description: "Demo appointment",
      daysFromNow: 3,
      hour: 9,
      status: "scheduled" as const,
    },
    // Additional scheduled appointments - spread out even more
    {
      patientIndex: 3,
      vetIndex: 2, // Weber
      title: "Ohrenuntersuchung",
      description: "Demo appointment",
      daysFromNow: 4,
      hour: 15,
      status: "scheduled" as const,
    },
    {
      patientIndex: 4,
      vetIndex: 1, // Mueller
      title: "Zahnkontrolle",
      description: "Demo appointment",
      daysFromNow: 5,
      hour: 11,
      status: "scheduled" as const,
    },
    {
      patientIndex: 5,
      vetIndex: 1, // Schmidt
      title: "Ultraschalluntersuchung",
      description: "Demo appointment",
      daysFromNow: 6,
      hour: 14,
      status: "scheduled" as const,
    },
  ],

  // ────────────────────────────────────────────────────────────────────────
  // ONLINE BOOKINGS (source: "online_booking")
  // vetIndex: 1=Mueller, 2=Schmidt, 3=Weber
  // ────────────────────────────────────────────────────────────────────────
  onlineBookings: [
    {
      patientIndex: 0, // Bella
      vetIndex: 0, // Mueller
      title: "Ohrenbehandlung",
      daysFromNow: 20,
      hour: 14,
      status: "scheduled" as const,
    },
    {
      patientIndex: 2, // Luna
      vetIndex: 1, // Schmidt
      title: "Allergie-Kontrolle",
      daysFromNow: 21,
      hour: 15,
      status: "scheduled" as const,
    },
    {
      patientIndex: 1, // Milo
      vetIndex: 2, // Weber
      title: "Zahnreinigung",
      daysFromNow: 22,
      hour: 11,
      status: "scheduled" as const,
    },
    {
      patientIndex: 4, // Whiskers
      vetIndex: 0, // Mueller
      title: "Gewichtskontrolle",
      daysFromNow: 23,
      hour: 10,
      status: "scheduled" as const,
    },
  ],

  // ────────────────────────────────────────────────────────────────────────
  // VET SCHEDULES (vetIndex = index in createdVets: 0=Mueller, 1=Schmidt, 2=Weber)
  // dayOfWeek: 0=Sun, 1=Mon, ..., 6=Sat
  // Omit days that are closed (no entry = uses practice opening hours fallback)
  // ────────────────────────────────────────────────────────────────────────
  vetSchedules: [
    // Dr. Mueller — Mo–Fr 8–18, Sa 10–14
    { vetIndex: 0, dayOfWeek: 1, slots: [{ startHour: 8, startMin: 0, endHour: 18, endMin: 0 }] },
    { vetIndex: 0, dayOfWeek: 2, slots: [{ startHour: 8, startMin: 0, endHour: 18, endMin: 0 }] },
    { vetIndex: 0, dayOfWeek: 3, slots: [{ startHour: 8, startMin: 0, endHour: 18, endMin: 0 }] },
    { vetIndex: 0, dayOfWeek: 4, slots: [{ startHour: 8, startMin: 0, endHour: 18, endMin: 0 }] },
    { vetIndex: 0, dayOfWeek: 5, slots: [{ startHour: 8, startMin: 0, endHour: 18, endMin: 0 }] },
    { vetIndex: 0, dayOfWeek: 6, slots: [{ startHour: 10, startMin: 0, endHour: 14, endMin: 0 }] },

    // Dr. Schmidt — Mo/Di/Do/Fr 9–17, Mi closed, Sa 9–14
    { vetIndex: 1, dayOfWeek: 1, slots: [{ startHour: 9, startMin: 0, endHour: 17, endMin: 0 }] },
    { vetIndex: 1, dayOfWeek: 2, slots: [{ startHour: 9, startMin: 0, endHour: 17, endMin: 0 }] },
    { vetIndex: 1, dayOfWeek: 3, slots: [] }, // Wednesday off
    { vetIndex: 1, dayOfWeek: 4, slots: [{ startHour: 9, startMin: 0, endHour: 17, endMin: 0 }] },
    { vetIndex: 1, dayOfWeek: 5, slots: [{ startHour: 9, startMin: 0, endHour: 17, endMin: 0 }] },
    { vetIndex: 1, dayOfWeek: 6, slots: [{ startHour: 9, startMin: 0, endHour: 14, endMin: 0 }] },

    // Dr. Weber — Mo–Fr 10–19 (Spätdienst)
    { vetIndex: 2, dayOfWeek: 1, slots: [{ startHour: 10, startMin: 0, endHour: 19, endMin: 0 }] },
    { vetIndex: 2, dayOfWeek: 2, slots: [{ startHour: 10, startMin: 0, endHour: 19, endMin: 0 }] },
    { vetIndex: 2, dayOfWeek: 3, slots: [{ startHour: 10, startMin: 0, endHour: 19, endMin: 0 }] },
    { vetIndex: 2, dayOfWeek: 4, slots: [{ startHour: 10, startMin: 0, endHour: 19, endMin: 0 }] },
    { vetIndex: 2, dayOfWeek: 5, slots: [{ startHour: 10, startMin: 0, endHour: 19, endMin: 0 }] },
  ],

  // ────────────────────────────────────────────────────────────────────────
  // VET ABSENCES (vetIndex = index in createdVets: 0=Mueller, 1=Schmidt, 2=Weber)
  // ────────────────────────────────────────────────────────────────────────
  vetAbsences: [
    { vetIndex: 0, startDate: "2026-05-04", endDate: "2026-05-08", type: "vacation" as const, note: "Urlaub" },
    { vetIndex: 1, startDate: "2026-04-28", endDate: "2026-04-29", type: "sick" as const, note: null },
    { vetIndex: 2, startDate: "2026-05-19", endDate: "2026-05-29", type: "vacation" as const, note: "Urlaub" },
  ],

  // ────────────────────────────────────────────────────────────────────────
  // REMINDER DEFAULTS (used by demo fixture generation/reset)
  // ────────────────────────────────────────────────────────────────────────
  demoReminderDefaults: {
    appointmentRemindersEnabled: false,
    vaccinationRemindersEnabled: false,
    appointmentReminderHoursBefore: 24,
  },

  // ────────────────────────────────────────────────────────────────────────
  // VACCINATION DEMO GENERATION RULES (used by demo fixture generation/reset)
  // ────────────────────────────────────────────────────────────────────────
  vaccinationDemoConfig: {
    typeCycle: [
      "Tollwut",
      "Staupe",
      "Leptospirose",
      "Parvovirose",
      "Katzenschnupfen",
      "Katzenseuche",
    ],
    primaryAdminDaysAgoBase: 180,
    primaryAdminDaysAgoStep: 7,
    primaryExpiryOverdueEveryNth: 3,
    primaryExpiryOverdueDays: -14,
    primaryExpiryUpcomingDaysBase: 45,
    primaryExpiryUpcomingDaysStep: 2,
    boosterAdminDaysAgoBase: 30,
    boosterAdminDaysAgoStep: 4,
    boosterExpiryDaysBase: 15,
    boosterExpiryDaysStep: 5,
    notesPrimary: "Automatisch erzeugter Demo-Impfeintrag",
    notesBooster: "Automatisch erzeugter Demo-Booster",
    batchPrefix: "DEMO",
  },
};

// ────────────────────────────────────────────────────────────────────────
// STATISTICS
// ────────────────────────────────────────────────────────────────────────

export function getTestDataStats() {
  return {
    owners: TEST_DATA.owners.length,
    patients: TEST_DATA.patients.length,
    diagnoses: TEST_DATA.diagnoses.length,
    medications: TEST_DATA.medications.length,
    vitals: TEST_DATA.vitals.length,
    internalAppointments: TEST_DATA.internalAppointments.length,
    onlineBookings: TEST_DATA.onlineBookings.length,
    totalAppointments:
      TEST_DATA.internalAppointments.length + TEST_DATA.onlineBookings.length,
    vets: TEST_DATA.users.filter(
      (u) => u.role === "vet" || u.additionalRoles?.includes("vet")
    ).length,
    vetSchedules: TEST_DATA.vetSchedules.length,
    vetAbsences: TEST_DATA.vetAbsences.length,
    vaccinationsPerPatient: 2,
    totalVaccinations: TEST_DATA.patients.length * 2,
  };
}
