import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  appointments,
  appointmentEmailLogs,
  appointmentHolds,
  diagnoses,
  medications,
  owners,
  patients,
  vaccinations,
  vaccinationEmailLogs,
  vetAbsences,
  vetSchedules,
  vitals,
  voiceCalls,
} from "@/lib/db/schema";

const CRON_SECRET = process.env.CRON_SECRET;

/**
 * Resets transient data for the E2E test tenant to a clean state.
 *
 * Keeps: tenant row, roles, user row, email settings.
 * Deletes: all patient data, appointments, and derived records.
 *
 * Auth: Bearer <CRON_SECRET> — same token used by other cron routes.
 * Called by Coolify scheduled task before E2E runs, and by CI pre-test hook.
 */
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!CRON_SECRET || authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenantId = process.env.E2E_TENANT_ID;
  if (!tenantId) {
    return NextResponse.json(
      { error: "E2E_TENANT_ID env var not set" },
      { status: 500 }
    );
  }

  try {
    const deleted = await deleteE2ETenantData(tenantId);

    return NextResponse.json({
      success: true,
      tenantId,
      deleted,
    });
  } catch (error) {
    console.error("E2E tenant reset failed:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to reset E2E tenant",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

const toCount = (value: unknown) => Number(value ?? 0);

async function deleteE2ETenantData(tenantId: string) {
  // Delete in dependency order (children before parents)
  const vaccinationEmailLogsResult = await db
    .delete(vaccinationEmailLogs)
    .where(eq(vaccinationEmailLogs.tenantId, tenantId));
  const appointmentEmailLogsResult = await db
    .delete(appointmentEmailLogs)
    .where(eq(appointmentEmailLogs.tenantId, tenantId));
  const appointmentHoldsResult = await db
    .delete(appointmentHolds)
    .where(eq(appointmentHolds.tenantId, tenantId));
  const vetAbsencesResult = await db
    .delete(vetAbsences)
    .where(eq(vetAbsences.tenantId, tenantId));
  const vetSchedulesResult = await db
    .delete(vetSchedules)
    .where(eq(vetSchedules.tenantId, tenantId));
  const voiceCallsResult = await db
    .delete(voiceCalls)
    .where(eq(voiceCalls.tenantId, tenantId));
  const medicationsResult = await db
    .delete(medications)
    .where(eq(medications.tenantId, tenantId));
  const vitalsResult = await db
    .delete(vitals)
    .where(eq(vitals.tenantId, tenantId));
  const diagnosesResult = await db
    .delete(diagnoses)
    .where(eq(diagnoses.tenantId, tenantId));
  const vaccinationsResult = await db
    .delete(vaccinations)
    .where(eq(vaccinations.tenantId, tenantId));
  const appointmentsResult = await db
    .delete(appointments)
    .where(eq(appointments.tenantId, tenantId));
  const patientsResult = await db
    .delete(patients)
    .where(eq(patients.tenantId, tenantId));
  const ownersResult = await db
    .delete(owners)
    .where(eq(owners.tenantId, tenantId));

  return {
    vaccinationEmailLogs: toCount(vaccinationEmailLogsResult.count),
    appointmentEmailLogs: toCount(appointmentEmailLogsResult.count),
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
  };
}

export const maxDuration = 60;
