"use client";

import { trpc } from "@/lib/trpc/client";
import { useTenant } from "@/hooks/useTenant";

export default function VaccinationAnalyticsPage() {
  const { tenantId } = useTenant();

  const { data: scanStats } = trpc.vaccinations.getScanStats.useQuery(
    { tenantId: tenantId ?? "" },
    { enabled: !!tenantId }
  );

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Impf-Analytics</h1>
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border bg-white p-4">
          <p className="text-sm text-gray-500">Gesamt erfasst</p>
          <p className="mt-1 text-2xl font-semibold">{scanStats?.totalTracked ?? 0}</p>
        </div>
        <div className="rounded-xl border bg-white p-4">
          <p className="text-sm text-gray-500">Überfällig</p>
          <p className="mt-1 text-2xl font-semibold">{scanStats?.totalDue ?? 0}</p>
        </div>
        <div className="rounded-xl border bg-white p-4">
          <p className="text-sm text-gray-500">In 30 Tagen fällig</p>
          <p className="mt-1 text-2xl font-semibold">{scanStats?.totalUpcoming ?? 0}</p>
        </div>
      </div>
      <div className="rounded-xl border bg-white p-4 text-sm text-gray-600">
        Conversion-Funnel und Reminder-zu-Termin-Korrelation können als nächster Schritt auf Basis
        der vorhandenen vaccination_email_logs aktiviert werden.
      </div>
    </div>
  );
}
