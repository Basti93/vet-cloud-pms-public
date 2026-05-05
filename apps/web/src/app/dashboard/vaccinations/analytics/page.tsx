"use client";

import Link from "next/link";
import { trpc } from "@/lib/trpc/client";
import { useTenant } from "@/hooks/useTenant";
import { Skeleton } from "@/components/ui/skeleton";

export default function VaccinationAnalyticsPage() {
  const { tenantId } = useTenant();

  const { data: scanStats, isLoading, isError } = trpc.vaccinations.getScanStats.useQuery(
    { tenantId: tenantId ?? "" },
    { enabled: !!tenantId }
  );

  const statCards = [
    { label: "Gesamt erfasst", value: scanStats?.totalTracked ?? 0, color: "text-fg" },
    { label: "Überfällig", value: scanStats?.totalDue ?? 0, color: "text-red-600" },
    { label: "In 30 Tagen fällig", value: scanStats?.totalUpcoming ?? 0, color: "text-amber-600" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-fg">Impf-Analytics</h1>
        <Link
          href="/dashboard/vaccinations"
          className="rounded-lg border border-border bg-surface px-3 py-2 text-sm font-medium text-fg hover:bg-muted-soft"
        >
          ← Übersicht
        </Link>
      </div>

      {isError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Statistiken konnten nicht geladen werden. Bitte Seite neu laden.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          {statCards.map(({ label, value, color }) => (
            <div key={label} className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
              <p className="text-sm text-muted">{label}</p>
              {isLoading ? (
                <Skeleton className="mt-2 h-8 w-16" />
              ) : (
                <p className={`mt-1 text-2xl font-semibold ${color}`}>{value}</p>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
        <p className="text-sm font-medium text-fg">Erinnerungsversand</p>
        <p className="mt-1 text-sm text-muted">
          Reminder-zu-Termin-Korrelation und Konversionsrate werden in der Einstellungsseite
          konfiguriert und im Admin-Dashboard ausgewertet.
        </p>
      </div>
    </div>
  );
}
