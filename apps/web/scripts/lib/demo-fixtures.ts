import { TEST_DATA } from "../test-data";

const DAY_MS = 24 * 60 * 60 * 1000;

export function getDemoReminderDefaults() {
  return TEST_DATA.demoReminderDefaults;
}

export function buildDemoVaccinationRows(params: {
  tenantId: string;
  patientIds: string[];
  vetIds: string[];
  now: Date;
}) {
  const cfg = TEST_DATA.vaccinationDemoConfig;
  const rows: Array<{
    tenantId: string;
    patientId: string;
    type: string;
    administeredDate: Date;
    expiryDate: Date;
    vetId: string;
    batchNumber: string;
    notes: string;
  }> = [];

  for (let idx = 0; idx < params.patientIds.length; idx++) {
    const patientId = params.patientIds[idx];
    const vetId = params.vetIds[idx % params.vetIds.length];
    const type = cfg.typeCycle[idx % cfg.typeCycle.length];
    if (!patientId || !vetId || !type) continue;

    const primaryAdmin = new Date(
      params.now.getTime() - (cfg.primaryAdminDaysAgoBase + idx * cfg.primaryAdminDaysAgoStep) * DAY_MS
    );
    const primaryExpiryDays =
      idx % cfg.primaryExpiryOverdueEveryNth === 0
        ? cfg.primaryExpiryOverdueDays
        : cfg.primaryExpiryUpcomingDaysBase + idx * cfg.primaryExpiryUpcomingDaysStep;
    const primaryExpiry = new Date(params.now.getTime() + primaryExpiryDays * DAY_MS);

    const boosterAdmin = new Date(
      params.now.getTime() - (cfg.boosterAdminDaysAgoBase + idx * cfg.boosterAdminDaysAgoStep) * DAY_MS
    );
    const boosterExpiry = new Date(
      params.now.getTime() + (cfg.boosterExpiryDaysBase + idx * cfg.boosterExpiryDaysStep) * DAY_MS
    );

    rows.push({
      tenantId: params.tenantId,
      patientId,
      type,
      administeredDate: primaryAdmin,
      expiryDate: primaryExpiry,
      vetId,
      batchNumber: `${cfg.batchPrefix}-${idx + 1}-A`,
      notes: cfg.notesPrimary,
    });

    rows.push({
      tenantId: params.tenantId,
      patientId,
      type: `${type} Booster`,
      administeredDate: boosterAdmin,
      expiryDate: boosterExpiry,
      vetId,
      batchNumber: `${cfg.batchPrefix}-${idx + 1}-B`,
      notes: cfg.notesBooster,
    });
  }

  return rows;
}
