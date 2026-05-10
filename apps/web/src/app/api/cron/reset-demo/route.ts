import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { seedVaccinationTypes } from "@/lib/db/seed-vaccination-types";
import {
  appointments,
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
  appointmentEmailLogs,
  appointmentHolds,
} from "@/lib/db/schema";
import { TEST_DATA, DEMO_TENANT_ID } from "../../../../../scripts/test-data";
import {
  buildDemoVaccinationRows,
  getDemoReminderDefaults,
} from "../../../../../scripts/lib/demo-fixtures";

const CRON_SECRET = process.env.CRON_SECRET;

/**
 * Cron endpoint: reset and reseed demo tenant data.
 * Auth via Authorization: Bearer <CRON_SECRET>
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!CRON_SECRET || authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await seedVaccinationTypes();

    const now = new Date();
    const t = TEST_DATA.tenant;
    const reminderDefaults = getDemoReminderDefaults();

    // Ensure demo tenant profile is present/synced.
    await db
      .insert(tenants)
      .values(t)
      .onConflictDoUpdate({
        target: tenants.id,
        set: {
          slug: t.slug,
          name: t.name,
          email: t.email,
          phone: t.phone,
          address: t.address,
          city: t.city,
          postalCode: t.postalCode,
          country: t.country,
          tagline: t.tagline,
          monogram: t.monogram,
          themePreference: t.themePreference,
          typographyPreference: t.typographyPreference,
          websiteTemplate: t.websiteTemplate,
          openingHours: t.openingHours,
          subscriptionStatus: t.subscriptionStatus,
          subscriptionPlan: t.subscriptionPlan,
          maxUsers: t.maxUsers,
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

    // Cleanup demo tenant data only (leave users/roles intact).
    await db.delete(appointmentEmailLogs).where(eq(appointmentEmailLogs.tenantId, DEMO_TENANT_ID));
    await db.delete(vaccinationEmailLogs).where(eq(vaccinationEmailLogs.tenantId, DEMO_TENANT_ID));
    await db.delete(appointmentHolds).where(eq(appointmentHolds.tenantId, DEMO_TENANT_ID));
    await db.delete(vetAbsences).where(eq(vetAbsences.tenantId, DEMO_TENANT_ID));
    await db.delete(vetSchedules).where(eq(vetSchedules.tenantId, DEMO_TENANT_ID));
    await db.delete(voiceCalls).where(eq(voiceCalls.tenantId, DEMO_TENANT_ID));
    await db.delete(medications).where(eq(medications.tenantId, DEMO_TENANT_ID));
    await db.delete(vitals).where(eq(vitals.tenantId, DEMO_TENANT_ID));
    await db.delete(diagnoses).where(eq(diagnoses.tenantId, DEMO_TENANT_ID));
    await db.delete(vaccinations).where(eq(vaccinations.tenantId, DEMO_TENANT_ID));
    await db.delete(appointments).where(eq(appointments.tenantId, DEMO_TENANT_ID));
    await db.delete(patients).where(eq(patients.tenantId, DEMO_TENANT_ID));
    await db.delete(owners).where(eq(owners.tenantId, DEMO_TENANT_ID));

    const allUsers = await db
      .select({
        id: users.id,
        email: users.email,
      })
      .from(users)
      .where(eq(users.tenantId, DEMO_TENANT_ID));

    const expectedVetEmails = TEST_DATA.users
      .filter((u) => u.role === "vet")
      .map((u) => u.email.toLowerCase());

    const createdVets = expectedVetEmails
      .map((email) => allUsers.find((u) => u.email.toLowerCase() === email))
      .filter((u): u is { id: string; email: string } => Boolean(u));

    if (createdVets.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error:
            "No demo vet users found. Run admin-reset.ts --reset once to bootstrap users/roles.",
        },
        { status: 409 }
      );
    }

    const defaultVetId = createdVets[0]!.id;

    const createdOwners = await Promise.all(
      TEST_DATA.owners.map((o) =>
        db
          .insert(owners)
          .values({ tenantId: DEMO_TENANT_ID, ...o })
          .returning()
          .then((r) => r[0]!)
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
          .then((r) => r[0]!)
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
          .then((r) => r[0]!)
      )
    );

    await Promise.all(
      TEST_DATA.medications.map(({ patientIndex, diagnosisIndex, ...medicationData }) =>
        db.insert(medications).values({
          tenantId: DEMO_TENANT_ID,
          prescribedBy: defaultVetId,
          patientId: createdPatients[patientIndex]!.id,
          diagnosisId:
            diagnosisIndex !== null ? createdDiagnoses[diagnosisIndex]!.id : undefined,
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
      patientIds: createdPatients.map((p) => p.id),
      vetIds: createdVets.map((v) => v.id),
      now,
    });
    if (vaccinationRows.length > 0) {
      await db.insert(vaccinations).values(vaccinationRows);
    }

    await Promise.all(
      TEST_DATA.vetSchedules.map((schedule) => {
        const vet = createdVets[schedule.vetIndex];
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
        const vet = createdVets[absence.vetIndex];
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
        const vet = createdVets[vetIndex] ?? createdVets[0];
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
        const vet = createdVets[vetIndex] ?? createdVets[0];
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

    return NextResponse.json({
      success: true,
      message: "Demo tenant reset completed",
      stats: {
        owners: createdOwners.length,
        patients: createdPatients.length,
        diagnoses: createdDiagnoses.length,
        vaccinations: vaccinationRows.length,
        appointments:
          TEST_DATA.internalAppointments.length + TEST_DATA.onlineBookings.length,
        vetSchedules: TEST_DATA.vetSchedules.length,
        vetAbsences: TEST_DATA.vetAbsences.length,
      },
    });
  } catch (error) {
    console.error("Demo cron reset failed:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to reset demo tenant",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

export const POST = GET;
export const maxDuration = 120;
