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
  },

  // ────────────────────────────────────────────────────────────────────────
  // USERS
  // ────────────────────────────────────────────────────────────────────────
  users: [
    {
      clerkId: "user_demo_admin_001",
      email: "admin@demo.example.com",
      firstName: "Dr.",
      lastName: "Admin",
      role: "admin" as const,
    },
    {
      clerkId: "user_demo_vet_001",
      email: "vet1@demo.example.com",
      firstName: "Dr.",
      lastName: "Mueller",
      role: "vet" as const,
    },
    {
      clerkId: "user_demo_vet_002",
      email: "vet2@demo.example.com",
      firstName: "Dr.",
      lastName: "Schmidt",
      role: "vet" as const,
    },
    {
      clerkId: "user_demo_vet_003",
      email: "vet3@demo.example.com",
      firstName: "Dr.",
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
  // ────────────────────────────────────────────────────────────────────────
  internalAppointments: [
    // Past (completed)
    {
      patientIndex: 0,
      title: "Routineuntersuchung",
      description: "Demo appointment",
      daysFromNow: -7,
      hour: 9,
      status: "completed" as const,
    },
    {
      patientIndex: 1,
      title: "Zahnreinigung",
      description: "Demo appointment",
      daysFromNow: -6,
      hour: 10,
      status: "completed" as const,
    },
    {
      patientIndex: 2,
      title: "Impfung (Tollwut)",
      description: "Demo appointment",
      daysFromNow: -5,
      hour: 11,
      status: "completed" as const,
    },
    {
      patientIndex: 3,
      title: "Parasitenkontrolle",
      description: "Demo appointment",
      daysFromNow: -4,
      hour: 14,
      status: "completed" as const,
    },
    // No-show
    {
      patientIndex: 4,
      title: "Untersuchung",
      description: "Demo appointment",
      daysFromNow: -3,
      hour: 9,
      status: "no-show" as const,
    },
    // Cancelled
    {
      patientIndex: 5,
      title: "Gesundheitscheck",
      description: "Demo appointment",
      daysFromNow: -2,
      hour: 10,
      status: "cancelled" as const,
    },
    // Future (scheduled)
    {
      patientIndex: 0,
      title: "Nachuntersuchung",
      description: "Demo appointment",
      daysFromNow: 1,
      hour: 9,
      status: "scheduled" as const,
    },
    {
      patientIndex: 2,
      title: "Impfauffrischung",
      description: "Demo appointment",
      daysFromNow: 3,
      hour: 10,
      status: "scheduled" as const,
    },
    {
      patientIndex: 1,
      title: "Routine Checkup",
      description: "Demo appointment",
      daysFromNow: 7,
      hour: 14,
      status: "scheduled" as const,
    },
  ],

  // ────────────────────────────────────────────────────────────────────────
  // ONLINE BOOKINGS (source: "online_booking")
  // ────────────────────────────────────────────────────────────────────────
  onlineBookings: [
    {
      patientIndex: 0, // Bella
      title: "Ohrenbehandlung",
      daysFromNow: 8,
      hour: 14,
      status: "scheduled" as const,
    },
    {
      patientIndex: 2, // Luna
      title: "Allergie-Kontrolle",
      daysFromNow: 10,
      hour: 15,
      status: "scheduled" as const,
    },
  ],

  // ────────────────────────────────────────────────────────────────────────
  // VET SCHEDULES (indexed by vetIndex in users array: 1=Mueller, 2=Schmidt, 3=Weber)
  // dayOfWeek: 0=Sun, 1=Mon, ..., 6=Sat
  // ────────────────────────────────────────────────────────────────────────
  vetSchedules: [
    // Dr. Mueller (vetIndex 1) - Monday to Friday, 8-18
    { vetIndex: 1, dayOfWeek: 1, startHour: 8, endHour: 18, isWorkingDay: true },
    { vetIndex: 1, dayOfWeek: 2, startHour: 8, endHour: 18, isWorkingDay: true },
    { vetIndex: 1, dayOfWeek: 3, startHour: 8, endHour: 18, isWorkingDay: true },
    { vetIndex: 1, dayOfWeek: 4, startHour: 8, endHour: 18, isWorkingDay: true },
    { vetIndex: 1, dayOfWeek: 5, startHour: 8, endHour: 18, isWorkingDay: true },
    { vetIndex: 1, dayOfWeek: 6, startHour: 10, endHour: 14, isWorkingDay: true }, // Saturday morning
    { vetIndex: 1, dayOfWeek: 0, startHour: 0, endHour: 0, isWorkingDay: false }, // Sunday off

    // Dr. Schmidt (vetIndex 2) - Tuesday to Saturday, 9-17
    { vetIndex: 2, dayOfWeek: 1, startHour: 9, endHour: 17, isWorkingDay: true },
    { vetIndex: 2, dayOfWeek: 2, startHour: 9, endHour: 17, isWorkingDay: true },
    { vetIndex: 2, dayOfWeek: 3, startHour: 0, endHour: 0, isWorkingDay: false }, // Wednesday off
    { vetIndex: 2, dayOfWeek: 4, startHour: 9, endHour: 17, isWorkingDay: true },
    { vetIndex: 2, dayOfWeek: 5, startHour: 9, endHour: 17, isWorkingDay: true },
    { vetIndex: 2, dayOfWeek: 6, startHour: 9, endHour: 14, isWorkingDay: true }, // Saturday afternoon
    { vetIndex: 2, dayOfWeek: 0, startHour: 0, endHour: 0, isWorkingDay: false }, // Sunday off

    // Dr. Weber (vetIndex 3) - Monday to Friday, 10-19 (late shift)
    { vetIndex: 3, dayOfWeek: 1, startHour: 10, endHour: 19, isWorkingDay: true },
    { vetIndex: 3, dayOfWeek: 2, startHour: 10, endHour: 19, isWorkingDay: true },
    { vetIndex: 3, dayOfWeek: 3, startHour: 10, endHour: 19, isWorkingDay: true },
    { vetIndex: 3, dayOfWeek: 4, startHour: 10, endHour: 19, isWorkingDay: true },
    { vetIndex: 3, dayOfWeek: 5, startHour: 10, endHour: 19, isWorkingDay: true },
    { vetIndex: 3, dayOfWeek: 6, startHour: 0, endHour: 0, isWorkingDay: false }, // Saturday off
    { vetIndex: 3, dayOfWeek: 0, startHour: 0, endHour: 0, isWorkingDay: false }, // Sunday off
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
