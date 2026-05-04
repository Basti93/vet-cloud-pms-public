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
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-fg">Impf-Analytics</h1>
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
          <p className="text-sm text-muted">Gesamt erfasst</p>
          <p className="mt-1 text-2xl font-semibold text-fg">{scanStats?.totalTracked ?? 0}</p>
        </div>
        <div className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
          <p className="text-sm text-muted">Überfällig</p>
          <p className="mt-1 text-2xl font-semibold text-fg">{scanStats?.totalDue ?? 0}</p>
        </div>
        <div className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
          <p className="text-sm text-muted">In 30 Tagen fällig</p>
          <p className="mt-1 text-2xl font-semibold text-fg">{scanStats?.totalUpcoming ?? 0}</p>
        </div>
      </div>
      <div className="rounded-2xl border border-border bg-surface p-4 text-sm text-muted shadow-sm">
        Conversion-Funnel und Reminder-zu-Termin-Korrelation können als nächster Schritt auf Basis
        der vorhandenen vaccination_email_logs aktiviert werden.
      </div>
    </div>
  );
}
