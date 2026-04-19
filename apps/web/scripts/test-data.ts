/**
 * Test Data Definition — Single Source of Truth
 * Used by both seed.ts and admin-reset.ts
 *
 * Keep this file as the authoritative source for all test data.
 * Changes here automatically apply to both scripts.
 */

export const DEMO_TENANT_ID = "00000000-0000-4000-8000-000000000003";
export const DEMO_TENANT_SLUG = "demo";

export const TEST_DATA = {
  // ────────────────────────────────────────────────────────────────────────
  // TENANT
  // ────────────────────────────────────────────────────────────────────────
  tenant: {
    id: DEMO_TENANT_ID,
    name: "Demo Praxis",
    slug: DEMO_TENANT_SLUG,
    email: "demo@example.com",
    phone: "+49 123 456789",
    address: "Musterstraße 1",
    city: "Musterstadt",
    postalCode: "12345",
    country: "DE",
    subscriptionStatus: "trial" as const,
    subscriptionPlan: "starter" as const,
    maxUsers: 5,
    themePreference: "sage" as const,
    typographyPreference: "modern" as const,
    websiteTemplate: "modern" as const,
    tagline: "Tierarztpraxis mit Leidenschaft",
    monogram: "DP",
  },

  // ────────────────────────────────────────────────────────────────────────
  // USERS
  // ────────────────────────────────────────────────────────────────────────
  users: [
    {
      clerkId: "user_demo_admin_001",
      tenantId: DEMO_TENANT_ID,
      email: "admin@demo.example.com",
      firstName: "Admin",
      lastName: "User",
      role: "admin" as const,
    },
    {
      clerkId: "user_demo_vet_001",
      tenantId: DEMO_TENANT_ID,
      email: "vet1@demo.example.com",
      title: "Dr.",
      firstName: "Max",
      lastName: "Mueller",
      role: "vet" as const,
    },
    {
      clerkId: "user_demo_vet_002",
      tenantId: DEMO_TENANT_ID,
      email: "vet2@demo.example.com",
      title: "Dr.",
      firstName: "Sarah",
      lastName: "Schmidt",
      role: "vet" as const,
    },
    {
      clerkId: "user_demo_vet_003",
      tenantId: DEMO_TENANT_ID,
      email: "vet3@demo.example.com",
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
      email: "max@example.com",
      phone: "+49 123 111111",
      address: "Beispielstraße 1",
      city: "Berlin",
      postalCode: "10115",
      country: "DE",
    },
    {
      firstName: "Erika",
      lastName: "Beispiel",
      email: "erika@example.com",
      phone: "+49 123 222222",
      address: "Beispielstraße 1",
      city: "Musterstadt",
      postalCode: "80331",
      country: "DE",
    },
    {
      firstName: "Thomas",
      lastName: "Test",
      email: "thomas@example.com",
      phone: "+49 123 333333",
      address: "Beispielstraße 1",
      city: "Hamburg",
      postalCode: "20095",
      country: "DE",
    },
    {
      firstName: "Julia",
      lastName: "Fischer",
      email: "julia@example.com",
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
  // VET SCHEDULES (indexed by vetIndex in users array: 1=Mueller, 2=Schmidt, 3=Weber)
  // dayOfWeek: 0=Sun, 1=Mon, ..., 6=Sat
  // ────────────────────────────────────────────────────────────────────────
  vetSchedules: [
    // Dr. Mueller (vetIndex 0) - Monday to Friday, 8-18
    { vetIndex: 0, dayOfWeek: 1, startHour: 8, endHour: 18, isWorkingDay: true },
    { vetIndex: 0, dayOfWeek: 2, startHour: 8, endHour: 18, isWorkingDay: true },
    { vetIndex: 0, dayOfWeek: 3, startHour: 8, endHour: 18, isWorkingDay: true },
    { vetIndex: 0, dayOfWeek: 4, startHour: 8, endHour: 18, isWorkingDay: true },
    { vetIndex: 0, dayOfWeek: 5, startHour: 8, endHour: 18, isWorkingDay: true },
    { vetIndex: 0, dayOfWeek: 6, startHour: 10, endHour: 14, isWorkingDay: true }, // Saturday morning
    { vetIndex: 0, dayOfWeek: 0, startHour: 0, endHour: 0, isWorkingDay: false }, // Sunday off

    // Dr. Schmidt (vetIndex 1) - Tuesday to Saturday, 9-17
    { vetIndex: 1, dayOfWeek: 1, startHour: 9, endHour: 17, isWorkingDay: true },
    { vetIndex: 1, dayOfWeek: 2, startHour: 9, endHour: 17, isWorkingDay: true },
    { vetIndex: 1, dayOfWeek: 3, startHour: 0, endHour: 0, isWorkingDay: false }, // Wednesday off
    { vetIndex: 1, dayOfWeek: 4, startHour: 9, endHour: 17, isWorkingDay: true },
    { vetIndex: 1, dayOfWeek: 5, startHour: 9, endHour: 17, isWorkingDay: true },
    { vetIndex: 1, dayOfWeek: 6, startHour: 9, endHour: 14, isWorkingDay: true }, // Saturday afternoon
    { vetIndex: 1, dayOfWeek: 0, startHour: 0, endHour: 0, isWorkingDay: false }, // Sunday off

    // Dr. Weber (vetIndex 2) - Monday to Friday, 10-19 (late shift)
    { vetIndex: 2, dayOfWeek: 1, startHour: 10, endHour: 19, isWorkingDay: true },
    { vetIndex: 2, dayOfWeek: 2, startHour: 10, endHour: 19, isWorkingDay: true },
    { vetIndex: 2, dayOfWeek: 3, startHour: 10, endHour: 19, isWorkingDay: true },
    { vetIndex: 2, dayOfWeek: 4, startHour: 10, endHour: 19, isWorkingDay: true },
    { vetIndex: 2, dayOfWeek: 5, startHour: 10, endHour: 19, isWorkingDay: true },
    { vetIndex: 2, dayOfWeek: 6, startHour: 0, endHour: 0, isWorkingDay: false }, // Saturday off
    { vetIndex: 2, dayOfWeek: 0, startHour: 0, endHour: 0, isWorkingDay: false }, // Sunday off
  ],
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
    vets: TEST_DATA.users.filter((u) => u.role === "vet").length,
    vetSchedules: TEST_DATA.vetSchedules.length,
  };
}
