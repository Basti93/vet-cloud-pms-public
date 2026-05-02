"use client";

import { trpc } from "@/lib/trpc";
import { useMemo, useState } from "react";
import type { ReactNode } from "react";

type Trend = "growing" | "shrinking" | "stable";

function toDateInputValue(date: Date) {
  return date.toISOString().slice(0, 10);
}

function toIsoStart(dateInput: string) {
  return new Date(`${dateInput}T00:00:00.000Z`).toISOString();
}

function toIsoEnd(dateInput: string) {
  return new Date(`${dateInput}T23:59:59.999Z`).toISOString();
}

export default function DashboardPage() {
  const today = new Date();
  const weekAgo = new Date(today.getTime() - 6 * 24 * 60 * 60 * 1000);

  const [tenantId, setTenantId] = useState<string>("all");
  const [fromDate, setFromDate] = useState<string>(toDateInputValue(weekAgo));
  const [toDate, setToDate] = useState<string>(toDateInputValue(today));

  const tenants = trpc.adminDashboard.core.listTenants.useQuery({
    limit: 200,
    search: undefined,
    plan: undefined,
    status: undefined,
  });

  const overview = trpc.adminDashboard.core.getTenantOverviewStats.useQuery(
    {
      hours: 24 * 7,
      limit: 50,
      tenantId: tenantId === "all" ? undefined : tenantId,
      from: toIsoStart(fromDate),
      to: toIsoEnd(toDate),
    },
    { refetchInterval: 30000 }
  );

  const items = useMemo(() => overview.data?.items ?? [], [overview.data?.items]);

  const kpis = useMemo(() => {
    const totalAppointments = items.reduce(
      (sum, item) => sum + item.appointmentsThisWeek,
      0
    );
    const totalPrevious = items.reduce(
      (sum, item) => sum + item.appointmentsLastWeek,
      0
    );
    const totalEvents = items.reduce((sum, item) => sum + item.eventsCount, 0);
    const suspiciousCount = items.filter((item) => item.suspicious).length;

    const topTenant =
      items.length > 0
        ? [...items].sort((a, b) => b.appointmentsThisWeek - a.appointmentsThisWeek)[0]
        : null;

    const deltaPct =
      totalPrevious > 0
        ? ((totalAppointments - totalPrevious) / totalPrevious) * 100
        : totalAppointments > 0
        ? 100
        : 0;

    return {
      totalAppointments,
      totalPrevious,
      totalEvents,
      suspiciousCount,
      topTenant,
      deltaPct: Math.round(deltaPct * 10) / 10,
    };
  }, [items]);

  const growingTenants = useMemo(
    () =>
      [...items]
        .filter((item) => item.appointmentTrend === "growing")
        .sort((a, b) => b.appointmentDeltaPct - a.appointmentDeltaPct)
        .slice(0, 5),
    [items]
  );

  const shrinkingTenants = useMemo(
    () =>
      [...items]
        .filter((item) => item.appointmentTrend === "shrinking")
        .sort((a, b) => a.appointmentDeltaPct - b.appointmentDeltaPct)
        .slice(0, 5),
    [items]
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">System-Übersicht</h2>
        <p className="mt-1 text-sm text-gray-500">
          Mandanten-Wachstum, Aktivität und Risikosignale als separate Widgets
        </p>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">
              Mandant
            </label>
            <select
              value={tenantId}
              onChange={(e) => setTenantId(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Alle Mandanten</option>
              {tenants.data?.items.map((tenant) => (
                <option key={tenant.id} value={tenant.id}>
                  {tenant.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">
              Von
            </label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">
              Bis
            </label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="rounded-lg border border-blue-100 bg-blue-50 p-3 text-xs text-blue-900">
            Vergleich: gleicher Zeitraum direkt davor (Trend grow/shrink).
          </div>
        </div>
      </div>

      {overview.isLoading ? (
        <div className="rounded-lg border border-gray-200 bg-white p-8 text-center text-gray-500">
          Lädt Übersicht...
        </div>
      ) : !items.length ? (
        <div className="rounded-lg border border-gray-200 bg-white p-8 text-center text-gray-500">
          Keine Daten für die aktuelle Filterung verfügbar
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              title="Termine im Zeitraum"
              value={kpis.totalAppointments}
              subtitle={`Vorperiode: ${kpis.totalPrevious} (${formatDeltaPct(
                kpis.deltaPct
              )})`}
            />
            <KpiCard
              title="Top-Mandant"
              value={kpis.topTenant?.name ?? "-"}
              subtitle={
                kpis.topTenant
                  ? `${kpis.topTenant.appointmentsThisWeek} Termine`
                  : "Keine Termine"
              }
            />
            <KpiCard
              title="Events gesamt"
              value={kpis.totalEvents}
              subtitle="Traffic + Audit"
            />
            <KpiCard
              title="Risikomandanten"
              value={kpis.suspiciousCount}
              subtitle="Fehlerquote > 20% oder Deletes/Exporte auffällig"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <WidgetCard title="Top Wachstum">
              <TenantTrendList items={growingTenants} emptyText="Kein Wachstum erkannt" />
            </WidgetCard>

            <WidgetCard title="Top Rückgang">
              <TenantTrendList items={shrinkingTenants} emptyText="Kein Rückgang erkannt" />
            </WidgetCard>

            <WidgetCard title="Risikoflaggen">
              <div className="space-y-2">
                {items
                  .filter((tenant) => tenant.suspicious)
                  .slice(0, 6)
                  .map((tenant) => (
                    <div
                      key={tenant.id}
                      className="rounded-lg border border-red-200 bg-red-50 p-3"
                    >
                      <p className="text-sm font-semibold text-red-900">{tenant.name}</p>
                      <p className="text-xs text-red-700">
                        Fehler {tenant.errorRate}% · Deletes {tenant.deleteCount} · Exporte {tenant.exportCount}
                      </p>
                    </div>
                  ))}
                {!items.some((tenant) => tenant.suspicious) && (
                  <p className="text-sm text-gray-500">Keine auffälligen Mandanten im Zeitraum.</p>
                )}
              </div>
            </WidgetCard>
          </div>

          <WidgetCard title="Mandantenliste (kompakt)">
            <div className="space-y-2">
              {items.map((tenant) => (
                <div
                  key={tenant.id}
                  className="rounded-lg border border-gray-200 bg-white p-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{tenant.name}</p>
                      <p className="text-xs text-gray-500">{tenant.slug}</p>
                    </div>
                    <TrendBadge
                      trend={tenant.appointmentTrend}
                      delta={tenant.appointmentDelta}
                      deltaPct={tenant.appointmentDeltaPct}
                    />
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                    <Stat label="Termine" value={`${tenant.appointmentsThisWeek} / ${tenant.appointmentsLastWeek}`} />
                    <Stat label="Traffic" value={tenant.trafficCount} />
                    <Stat label="Änderungen" value={tenant.changeCount} />
                    <Stat label="Fehlerquote" value={`${tenant.errorRate}%`} />
                  </div>
                </div>
              ))}
            </div>
          </WidgetCard>
        </>
      )}
    </div>
  );
}

function KpiCard({ title, value, subtitle }: { title: string; value: string | number; subtitle: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{title}</p>
      <p className="mt-2 text-2xl font-bold text-gray-900">{value}</p>
      <p className="mt-1 text-xs text-gray-500">{subtitle}</p>
    </div>
  );
}

function WidgetCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <h3 className="mb-3 text-sm font-semibold text-gray-900">{title}</h3>
      {children}
    </div>
  );
}

function TenantTrendList({
  items,
  emptyText,
}: {
  items: Array<{
    id: string;
    name: string;
    appointmentsThisWeek: number;
    appointmentsLastWeek: number;
    appointmentDeltaPct: number;
    appointmentTrend: Trend;
    appointmentDelta: number;
  }>;
  emptyText: string;
}) {
  if (!items.length) {
    return <p className="text-sm text-gray-500">{emptyText}</p>;
  }

  return (
    <div className="space-y-2">
      {items.map((tenant) => (
        <div key={tenant.id} className="rounded-lg border border-gray-200 p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-gray-900">{tenant.name}</p>
            <TrendBadge
              trend={tenant.appointmentTrend}
              delta={tenant.appointmentDelta}
              deltaPct={tenant.appointmentDeltaPct}
            />
          </div>
          <p className="mt-1 text-xs text-gray-500">
            Termine: {tenant.appointmentsThisWeek} / {tenant.appointmentsLastWeek}
          </p>
        </div>
      ))}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded border border-gray-200 px-2 py-1">
      <p className="text-[10px] uppercase tracking-wide text-gray-500">{label}</p>
      <p className="text-sm font-semibold text-gray-900">{value}</p>
    </div>
  );
}

function TrendBadge({
  trend,
  delta,
  deltaPct,
}: {
  trend: Trend;
  delta: number;
  deltaPct: number;
}) {
  const base = "inline-flex rounded-full px-2 py-1 text-xs font-semibold";
  if (trend === "growing") {
    return (
      <span className={`${base} bg-emerald-100 text-emerald-800`}>
        ▲ Wachsend {delta > 0 ? `+${delta}` : delta} ({formatDeltaPct(deltaPct)})
      </span>
    );
  }

  if (trend === "shrinking") {
    return (
      <span className={`${base} bg-amber-100 text-amber-800`}>
        ▼ Rückgang {delta} ({formatDeltaPct(deltaPct)})
      </span>
    );
  }

  return (
    <span className={`${base} bg-gray-100 text-gray-700`}>
      ▬ Stabil ({formatDeltaPct(deltaPct)})
    </span>
  );
}

function formatDeltaPct(value: number) {
  return `${value > 0 ? "+" : ""}${value}%`;
}
