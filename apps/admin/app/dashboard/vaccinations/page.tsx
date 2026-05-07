"use client";

import { useState } from "react";
import { CheckCircle, ChevronDown, ChevronUp, XCircle } from "lucide-react";
import { trpc } from "@/lib/trpc";

export default function AdminVaccinationsPage() {
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);
  const [days, setDays] = useState(30);

  const global = trpc.adminDashboard.vaccinations.getGlobalStats.useQuery();
  const overview = trpc.adminDashboard.vaccinations.getTenantOverview.useQuery({ days });
  const tenantStats = trpc.adminDashboard.vaccinations.getTenantStats.useQuery(
    { tenantId: selectedTenantId ?? "00000000-0000-0000-0000-000000000000" },
    { enabled: !!selectedTenantId }
  );

  const selectedTenantName = overview.data?.items.find(
    (r) => r.tenantId === selectedTenantId
  )?.tenantName;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Impf-Reminder Monitoring</h1>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-gray-500">Zeitraum:</span>
          {[7, 30, 90].map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`rounded-lg px-3 py-1.5 font-medium transition-colors ${
                days === d
                  ? "bg-gray-900 text-white"
                  : "border border-gray-200 text-gray-600 hover:bg-gray-50"
              }`}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      {/* Global stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-5">
        <StatCard
          label="Gesendet (gesamt)"
          value={global.data?.totalRemindersSent ?? 0}
          loading={global.isLoading}
        />
        <StatCard
          label="Fehlgeschlagen (gesamt)"
          value={global.data?.totalRemindersFailed ?? 0}
          loading={global.isLoading}
          danger={(global.data?.totalRemindersFailed ?? 0) > 0}
        />
        <StatCard
          label="Erfolgsquote"
          value={`${global.data?.successRate ?? 0}%`}
          loading={global.isLoading}
        />
        <StatCard
          label="Terminkonversionen"
          value={global.data?.totalConversions ?? 0}
          loading={global.isLoading}
          hint={`${global.data?.averageConversionRate ?? 0}% Konversionsrate`}
        />
        <StatCard
          label="Letzter Scan"
          value={
            global.data?.lastScanAt
              ? new Date(global.data.lastScanAt).toLocaleString("de-DE", {
                  day: "2-digit",
                  month: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "—"
          }
          loading={global.isLoading}
        />
      </div>

      {/* Per-tenant overview table */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
          <p className="text-sm font-medium text-gray-900">
            Mandantenübersicht ({days} Tage)
          </p>
          {overview.isLoading && (
            <span className="text-xs text-gray-400">Lade…</span>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-3">Mandant</th>
                <th className="px-4 py-3 text-right">Gesamt</th>
                <th className="px-4 py-3 text-right">Gesendet</th>
                <th className="px-4 py-3 text-right">Fehlgeschlagen</th>
                <th className="px-4 py-3 text-right">Erfolgsquote</th>
                <th className="px-4 py-3 text-right">Konversionen</th>
                <th className="px-4 py-3 text-right">Konversionsrate</th>
              </tr>
            </thead>
            <tbody>
              {overview.isLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i} className="border-t border-gray-100">
                    {Array.from({ length: 7 }).map((__, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 animate-pulse rounded bg-gray-100" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : overview.data?.items.length === 0 ? (
                <tr>
                  <td className="px-4 py-8 text-center text-gray-400" colSpan={7}>
                    Keine Daten im gewählten Zeitraum.
                  </td>
                </tr>
              ) : (
                overview.data?.items.map((row) => {
                  const isSelected = selectedTenantId === row.tenantId;
                  return (
                    <tr
                      key={row.tenantId}
                      className={`cursor-pointer border-t border-gray-100 transition-colors ${
                        isSelected
                          ? "bg-gray-50"
                          : "hover:bg-gray-50"
                      }`}
                      onClick={() =>
                        setSelectedTenantId(isSelected ? null : row.tenantId)
                      }
                    >
                      <td className="px-4 py-3 font-medium text-gray-900">
                        <span className="flex items-center gap-1.5">
                          {row.tenantName}
                          {isSelected ? (
                            <ChevronUp className="h-3.5 w-3.5 text-gray-400" />
                          ) : (
                            <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
                          )}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-gray-500">{row.total}</td>
                      <td className="px-4 py-3 text-right">{row.sent}</td>
                      <td className="px-4 py-3 text-right">
                        {row.failed > 0 ? (
                          <span className="font-medium text-red-600">{row.failed}</span>
                        ) : (
                          <span className="text-gray-400">0</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-700">
                        {row.successRate}%
                      </td>
                      <td className="px-4 py-3 text-right text-gray-700">
                        {row.conversions}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span
                          className={`font-medium ${
                            row.conversionRate >= 20
                              ? "text-green-600"
                              : row.conversionRate >= 10
                              ? "text-amber-600"
                              : "text-gray-500"
                          }`}
                        >
                          {row.conversionRate}%
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Per-tenant detail panel */}
      {selectedTenantId && (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          <div className="border-b border-gray-200 px-4 py-3">
            <h2 className="text-sm font-semibold text-gray-900">
              {selectedTenantName ?? selectedTenantId} — Letzte Erinnerungen
            </h2>
            {tenantStats.data && (
              <p className="mt-0.5 text-xs text-gray-500">
                {tenantStats.data.remindersSentThisPeriod} gesendet ·{" "}
                {tenantStats.data.failedCount} fehlgeschlagen ·{" "}
                {tenantStats.data.appointmentConversions} Konversionen (
                {tenantStats.data.conversionRate}%)
              </p>
            )}
          </div>

          {tenantStats.isLoading ? (
            <div className="divide-y divide-gray-100">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex gap-3 px-4 py-3">
                  <div className="h-4 w-4 animate-pulse rounded-full bg-gray-100 mt-0.5 shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3.5 w-48 animate-pulse rounded bg-gray-100" />
                    <div className="h-3 w-32 animate-pulse rounded bg-gray-100" />
                  </div>
                </div>
              ))}
            </div>
          ) : tenantStats.data?.recentReminders.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-gray-400">
              Keine Erinnerungen in diesem Zeitraum.
            </p>
          ) : (
            <div className="divide-y divide-gray-100">
              {tenantStats.data?.recentReminders.map((log) => (
                <div key={log.id} className="flex items-start gap-3 px-4 py-3">
                  {log.status === "sent" ? (
                    <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
                  ) : (
                    <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-900">
                      {log.vaccinationType} · {log.emailAddress}
                    </p>
                    <p className="mt-0.5 text-xs text-gray-500">
                      {new Date(log.sentAt).toLocaleString("de-DE", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                      {log.expiryDate && (
                        <> · Fällig: {new Date(log.expiryDate).toLocaleDateString("de-DE")}</>
                      )}
                      {log.converted && (
                        <span className="ml-1.5 inline-flex items-center rounded-full bg-green-100 px-1.5 py-0.5 text-xs font-medium text-green-700">
                          Termin gebucht
                        </span>
                      )}
                    </p>
                    {log.error && (
                      <p className="mt-0.5 text-xs text-red-600">{log.error}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  loading,
  danger,
  hint,
}: {
  label: string;
  value: string | number;
  loading?: boolean;
  danger?: boolean;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
      {loading ? (
        <div className="mt-2 h-7 w-16 animate-pulse rounded bg-gray-100" />
      ) : (
        <p
          className={`mt-1 text-2xl font-semibold ${
            danger ? "text-red-600" : "text-gray-900"
          }`}
        >
          {value}
        </p>
      )}
      {hint && <p className="mt-0.5 text-xs text-gray-400">{hint}</p>}
    </div>
  );
}
