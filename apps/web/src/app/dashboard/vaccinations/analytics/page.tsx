"use client";

import Link from "next/link";
import { trpc } from "@/lib/trpc/client";
import { useTenant } from "@/hooks/useTenant";
import { Skeleton } from "@/components/ui/skeleton";

export default function VaccinationAnalyticsPage() {
  const { tenantId } = useTenant();

  const { data: scanStats, isLoading: scanLoading, isError: scanError } =
    trpc.vaccinations.getScanStats.useQuery(
      { tenantId: tenantId ?? "" },
      { enabled: !!tenantId }
    );

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

      {scanError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Statistiken konnten nicht geladen werden. Bitte Seite neu laden.
        </div>
      ) : (
        <>
          {/* Vaccination status cards */}
          <div>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
              Impfstatus
            </h2>
            <div className="grid gap-4 md:grid-cols-3">
              {[
                {
                  label: "Gesamt erfasst",
                  value: scanStats?.totalTracked,
                  color: "text-fg",
                },
                {
                  label: "Überfällig",
                  value: scanStats?.totalDue,
                  color: "text-red-600",
                },
                {
                  label: "In 30 Tagen fällig",
                  value: scanStats?.totalUpcoming,
                  color: "text-amber-600",
                },
              ].map(({ label, value, color }) => (
                <div
                  key={label}
                  className="rounded-2xl border border-border bg-surface p-4 shadow-sm"
                >
                  <p className="text-sm text-muted">{label}</p>
                  {scanLoading ? (
                    <Skeleton className="mt-2 h-8 w-16" />
                  ) : (
                    <p className={`mt-1 text-2xl font-semibold ${color}`}>
                      {value ?? 0}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Reminder effectiveness note */}
          <div className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
            <p className="text-sm font-medium text-fg">Erinnerungsversand & Konversion</p>
            <p className="mt-1 text-sm text-muted">
              Detaillierte Reminder-Statistiken und Konversionsraten (Reminder → Termin, 14-Tage-Fenster)
              sind im Admin-Dashboard unter <span className="font-medium text-fg">Vaccination Analytics</span> verfügbar.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
