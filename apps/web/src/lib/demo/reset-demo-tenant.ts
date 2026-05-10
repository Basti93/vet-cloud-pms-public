import { eq, sql } from "drizzle-orm";
import { seedVaccinationTypes } from "@/lib/db/seed-vaccination-types";
import type { Database } from "@/lib/db/client";
import {
  appointments,
  appointmentEmailLogs,
  appointmentHolds,
  diagnoses,
  emailSettings,
  medications,
  owners,
  patients,
  tenants,
  users,
  vaccinationEmailLogs,
  vaccinations,
  vaccinationSettings,
  vetAbsences,
  vetSchedules,
  vitals,
  voiceCalls,
} from "@/lib/db/schema";
import { TEST_DATA, DEMO_TENANT_ID } from "../../../scripts/test-data";
import {
  buildDemoVaccinationRows,
  getDemoReminderDefaults,
} from "../../../scripts/lib/demo-fixtures";

export type DemoVetUser = {
  id: string;
  email: string;
};

export type DemoResetSummary = {
  deleted: {
    appointmentEmailLogs: number;
    vaccinationEmailLogs: number;
    appointmentHolds: number;
    vetAbsences: number;
    vetSchedules: number;
    voiceCalls: number;
    medications: number;
    vitals: number;
    diagnoses: number;
    vaccinations: number;
    appointments: number;
    patients: number;
    owners: number;
  };
  created: {
    owners: number;
    patients: number;
    diagnoses: number;
    medications: number;
    vitals: number;
    vaccinations: number;
    appointments: number;
    vetSchedules: number;
    vetAbsences: number;
  };
  verification: {
    users: number;
    owners: number;
    patients: number;
    appointments: number;
    vaccinations: number;
    vetSchedules: number;
    vetAbsences: number;
    appointmentRange: {
      minStartIso: string;
      maxStartIso: string;
    };
  };
};

const toCount = (value: unknown) => Number(value ?? 0);

const formatIso = (value: unknown): string => {
  if (!value) return "n/a";
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? "n/a" : date.toISOString();
};

export function getExpectedDemoVetEmails(): string[] {
  return TEST_DATA.users
    .filter((u) => u.role === "vet")
    .map((u) => u.email.toLowerCase());
}

export async function getDemoVetUsersFromTenant(db: Database): Promise<DemoVetUser[]> {
  const allUsers = await db
    .select({
      id: users.id,
      email: users.email,
    })
    .from(users)
    .where(eq(users.tenantId, DEMO_TENANT_ID));

  const expectedVetEmails = getExpectedDemoVetEmails();
  return expectedVetEmails
    .map((email) => allUsers.find((u) => u.email.toLowerCase() === email))
    .filter((u): u is DemoVetUser => Boolean(u));
}

export async function resetDemoTenantData({
  db,
  vetUsers,
  now = new Date(),
  seedVaccinationTypesFirst = true,
}: {
  db: Database;
  vetUsers: DemoVetUser[];
  now?: Date;
  seedVaccinationTypesFirst?: boolean;
}): Promise<DemoResetSummary> {
  if (vetUsers.length === 0) {
    throw new Error(
      "No demo vet users found. Run scripts/demo-reset.ts --reset once to bootstrap users/roles."
    );
  }

  if (seedVaccinationTypesFirst) {
    await seedVaccinationTypes();
  }

  const reminderDefaults = getDemoReminderDefaults();
  const demoTenant = TEST_DATA.tenant;

  await db
    .insert(tenants)
    .values(demoTenant)
    .onConflictDoUpdate({
      target: tenants.id,
      set: {
        slug: demoTenant.slug,
        name: demoTenant.name,
        email: demoTenant.email,
        phone: demoTenant.phone,
        address: demoTenant.address,
        city: demoTenant.city,
        postalCode: demoTenant.postalCode,
        country: demoTenant.country,
        tagline: demoTenant.tagline,
        monogram: demoTenant.monogram,
        themePreference: demoTenant.themePreference,
        typographyPreference: demoTenant.typographyPreference,
        websiteTemplate: demoTenant.websiteTemplate,
        openingHours: demoTenant.openingHours,
        subscriptionStatus: demoTenant.subscriptionStatus,
        subscriptionPlan: demoTenant.subscriptionPlan,
        maxUsers: demoTenant.maxUsers,
        updatedAt: new Date(),
      },
    });

  await db
    .insert(emailSettings)
    .values({
      tenantId: DEMO_TENANT_ID,
      reminderEmailEnabled: reminderDefaults.appointmentRemindersEnabled,
      reminderHoursBefore: reminderDefaults.appointmentReminderHoursBefore,
    })
    .onConflictDoUpdate({
      target: emailSettings.tenantId,
      set: {
        reminderEmailEnabled: reminderDefaults.appointmentRemindersEnabled,
        reminderHoursBefore: reminderDefaults.appointmentReminderHoursBefore,
        updatedAt: new Date(),
      },
    });

  await db
    .insert(vaccinationSettings)
    .values({
      tenantId: DEMO_TENANT_ID,
      reminderEnabled: reminderDefaults.vaccinationRemindersEnabled,
    })
    .onConflictDoUpdate({
      target: vaccinationSettings.tenantId,
      set: {
        reminderEnabled: reminderDefaults.vaccinationRemindersEnabled,
        updatedAt: new Date(),
      },
    });

  const appointmentEmailLogsResult = await db
    .delete(appointmentEmailLogs)
    .where(eq(appointmentEmailLogs.tenantId, DEMO_TENANT_ID));
  const vaccinationEmailLogsResult = await db
    .delete(vaccinationEmailLogs)
    .where(eq(vaccinationEmailLogs.tenantId, DEMO_TENANT_ID));
  const appointmentHoldsResult = await db
    .delete(appointmentHolds)
    .where(eq(appointmentHolds.tenantId, DEMO_TENANT_ID));
  const vetAbsencesResult = await db
    .delete(vetAbsences)
    .where(eq(vetAbsences.tenantId, DEMO_TENANT_ID));
  const vetSchedulesResult = await db
    .delete(vetSchedules)
    .where(eq(vetSchedules.tenantId, DEMO_TENANT_ID));
  const voiceCallsResult = await db
    .delete(voiceCalls)
    .where(eq(voiceCalls.tenantId, DEMO_TENANT_ID));
  const medicationsResult = await db
    .delete(medications)
    .where(eq(medications.tenantId, DEMO_TENANT_ID));
  const vitalsResult = await db.delete(vitals).where(eq(vitals.tenantId, DEMO_TENANT_ID));
  const diagnosesResult = await db
    .delete(diagnoses)
    .where(eq(diagnoses.tenantId, DEMO_TENANT_ID));
  const vaccinationsResult = await db
    .delete(vaccinations)
    .where(eq(vaccinations.tenantId, DEMO_TENANT_ID));
  const appointmentsResult = await db
    .delete(appointments)
    .where(eq(appointments.tenantId, DEMO_TENANT_ID));
  const patientsResult = await db
    .delete(patients)
    .where(eq(patients.tenantId, DEMO_TENANT_ID));
  const ownersResult = await db.delete(owners).where(eq(owners.tenantId, DEMO_TENANT_ID));

  const defaultVetId = vetUsers[0]!.id;

  const createdOwners = await Promise.all(
    TEST_DATA.owners.map((owner) =>
      db
        .insert(owners)
        .values({ tenantId: DEMO_TENANT_ID, ...owner })
        .returning()
        .then((result) => result[0]!)
    )
  );

  const createdPatients = await Promise.all(
    TEST_DATA.patients.map(({ ownerIndex, ...patientData }) =>
      db
        .insert(patients)
        .values({
          tenantId: DEMO_TENANT_ID,
          ownerId: createdOwners[ownerIndex]!.id,
          ...patientData,
          birthDate: new Date(new Date().getFullYear() - 3, 0, 1),
          active: true,
        })
        .returning()
        .then((result) => result[0]!)
    )
  );

  const createdDiagnoses = await Promise.all(
    TEST_DATA.diagnoses.map(({ patientIndex, ...diagnosisData }) =>
      db
        .insert(diagnoses)
        .values({
          tenantId: DEMO_TENANT_ID,
          vetId: defaultVetId,
          patientId: createdPatients[patientIndex]!.id,
          ...diagnosisData,
          dateOfDiagnosis: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
        })
        .returning()
        .then((result) => result[0]!)
    )
  );

  await Promise.all(
    TEST_DATA.medications.map(({ patientIndex, diagnosisIndex, ...medicationData }) =>
      db.insert(medications).values({
        tenantId: DEMO_TENANT_ID,
        prescribedBy: defaultVetId,
        patientId: createdPatients[patientIndex]!.id,
        diagnosisId: diagnosisIndex !== null ? createdDiagnoses[diagnosisIndex]!.id : undefined,
        ...medicationData,
        startDate: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
      })
    )
  );

  await Promise.all(
    TEST_DATA.vitals.map(({ patientIndex, daysAgo, ...vitalData }) =>
      db.insert(vitals).values({
        tenantId: DEMO_TENANT_ID,
        recordedBy: defaultVetId,
        patientId: createdPatients[patientIndex]!.id,
        ...vitalData,
        recordedAt: new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000),
      })
    )
  );

  const vaccinationRows = buildDemoVaccinationRows({
    tenantId: DEMO_TENANT_ID,
    patientIds: createdPatients.map((patient) => patient.id),
    vetIds: vetUsers.map((vet) => vet.id),
    now,
  });
  if (vaccinationRows.length > 0) {
    await db.insert(vaccinations).values(vaccinationRows);
  }

  await Promise.all(
    TEST_DATA.vetSchedules.map((schedule) => {
      const vet = vetUsers[schedule.vetIndex];
      if (!vet) return null;
      return db.insert(vetSchedules).values({
        tenantId: DEMO_TENANT_ID,
        vetId: vet.id,
        dayOfWeek: schedule.dayOfWeek,
        slots: schedule.slots,
      });
    })
  );

  await Promise.all(
    TEST_DATA.vetAbsences.map((absence) => {
      const vet = vetUsers[absence.vetIndex];
      if (!vet) return null;
      return db.insert(vetAbsences).values({
        tenantId: DEMO_TENANT_ID,
        vetId: vet.id,
        startDate: absence.startDate,
        endDate: absence.endDate,
        type: absence.type,
        note: absence.note ?? null,
      });
    })
  );

  await Promise.all(
    TEST_DATA.internalAppointments.map(({ patientIndex, vetIndex, daysFromNow, hour, ...aptData }) => {
      const vet = vetUsers[vetIndex] ?? vetUsers[0];
      if (!vet) return null;
      const startTime = new Date(now.getTime() + daysFromNow * 24 * 60 * 60 * 1000);
      startTime.setHours(hour, 0, 0, 0);
      const endTime = new Date(startTime.getTime() + 30 * 60 * 1000);
      return db.insert(appointments).values({
        tenantId: DEMO_TENANT_ID,
        patientId: createdPatients[patientIndex]!.id,
        vetId: vet.id,
        startTime,
        endTime,
        ...aptData,
        source: "manual",
      });
    })
  );

  await Promise.all(
    TEST_DATA.onlineBookings.map(({ patientIndex, vetIndex, daysFromNow, hour, ...bookingData }) => {
      const vet = vetUsers[vetIndex] ?? vetUsers[0];
      if (!vet) return null;
      const startTime = new Date(now.getTime() + daysFromNow * 24 * 60 * 60 * 1000);
      startTime.setHours(hour, 0, 0, 0);
      const endTime = new Date(startTime.getTime() + 30 * 60 * 1000);
      return db.insert(appointments).values({
        tenantId: DEMO_TENANT_ID,
        patientId: createdPatients[patientIndex]!.id,
        vetId: vet.id,
        startTime,
        endTime,
        ...bookingData,
        source: "online_booking",
      });
    })
  );

  const [persistedUsers] = await db
    .select({ count: sql`count(*)` })
    .from(users)
    .where(eq(users.tenantId, DEMO_TENANT_ID));
  const [persistedOwners] = await db
    .select({ count: sql`count(*)` })
    .from(owners)
    .where(eq(owners.tenantId, DEMO_TENANT_ID));
  const [persistedPatients] = await db
    .select({ count: sql`count(*)` })
    .from(patients)
    .where(eq(patients.tenantId, DEMO_TENANT_ID));
  const [persistedAppointments] = await db
    .select({ count: sql`count(*)` })
    .from(appointments)
    .where(eq(appointments.tenantId, DEMO_TENANT_ID));
  const [persistedVaccinations] = await db
    .select({ count: sql`count(*)` })
    .from(vaccinations)
    .where(eq(vaccinations.tenantId, DEMO_TENANT_ID));
  const [persistedSchedules] = await db
    .select({ count: sql`count(*)` })
    .from(vetSchedules)
    .where(eq(vetSchedules.tenantId, DEMO_TENANT_ID));
  const [persistedAbsences] = await db
    .select({ count: sql`count(*)` })
    .from(vetAbsences)
    .where(eq(vetAbsences.tenantId, DEMO_TENANT_ID));
  const [appointmentRange] = await db
    .select({
      minStart: sql`min(${appointments.startTime})`,
      maxStart: sql`max(${appointments.startTime})`,
    })
    .from(appointments)
    .where(eq(appointments.tenantId, DEMO_TENANT_ID));

  const verification = {
    users: toCount(persistedUsers?.count),
    owners: toCount(persistedOwners?.count),
    patients: toCount(persistedPatients?.count),
    appointments: toCount(persistedAppointments?.count),
    vaccinations: toCount(persistedVaccinations?.count),
    vetSchedules: toCount(persistedSchedules?.count),
    vetAbsences: toCount(persistedAbsences?.count),
    appointmentRange: {
      minStartIso: formatIso(appointmentRange?.minStart),
      maxStartIso: formatIso(appointmentRange?.maxStart),
    },
  };

  if (
    verification.owners === 0 ||
    verification.patients === 0 ||
    verification.appointments === 0 ||
    verification.vaccinations === 0 ||
    verification.vetSchedules === 0
  ) {
    throw new Error(`Post-reset verification failed: ${JSON.stringify(verification)}`);
  }

  return {
    deleted: {
      appointmentEmailLogs: toCount(appointmentEmailLogsResult.count),
      vaccinationEmailLogs: toCount(vaccinationEmailLogsResult.count),
      appointmentHolds: toCount(appointmentHoldsResult.count),
      vetAbsences: toCount(vetAbsencesResult.count),
      vetSchedules: toCount(vetSchedulesResult.count),
      voiceCalls: toCount(voiceCallsResult.count),
      medications: toCount(medicationsResult.count),
      vitals: toCount(vitalsResult.count),
      diagnoses: toCount(diagnosesResult.count),
      vaccinations: toCount(vaccinationsResult.count),
      appointments: toCount(appointmentsResult.count),
      patients: toCount(patientsResult.count),
      owners: toCount(ownersResult.count),
    },
    created: {
      owners: createdOwners.length,
      patients: createdPatients.length,
      diagnoses: createdDiagnoses.length,
      medications: TEST_DATA.medications.length,
      vitals: TEST_DATA.vitals.length,
      vaccinations: vaccinationRows.length,
      appointments: TEST_DATA.internalAppointments.length + TEST_DATA.onlineBookings.length,
      vetSchedules: TEST_DATA.vetSchedules.length,
      vetAbsences: TEST_DATA.vetAbsences.length,
    },
    verification,
  };
}
