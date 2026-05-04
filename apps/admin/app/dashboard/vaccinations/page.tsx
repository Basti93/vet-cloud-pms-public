"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";

export default function AdminVaccinationsPage() {
  const [tenantId, setTenantId] = useState<string | null>(null);

  const global = trpc.adminDashboard.vaccinations.getGlobalStats.useQuery();
  const overview = trpc.adminDashboard.vaccinations.getTenantOverview.useQuery({ days: 30 });
  const tenantStats = trpc.adminDashboard.vaccinations.getTenantStats.useQuery(
    { tenantId: tenantId ?? "00000000-0000-0000-0000-000000000000" },
    { enabled: !!tenantId }
  );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Impf-Reminder Monitoring</h1>

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Gesendet" value={global.data?.totalRemindersSent ?? 0} />
        <StatCard label="Fehlgeschlagen" value={global.data?.totalRemindersFailed ?? 0} />
        <StatCard label="Erfolgsquote" value={`${global.data?.successRate ?? 0}%`} />
        <StatCard
          label="Letzter Scan"
          value={global.data?.lastScanAt ? new Date(global.data.lastScanAt).toLocaleString("de-DE") : "-"}
        />
      </div>

      <div className="rounded-xl border bg-white">
        <div className="border-b px-4 py-3 text-sm font-medium">Mandantenübersicht (30 Tage)</div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3">Mandant</th>
                <th className="px-4 py-3">Gesamt</th>
                <th className="px-4 py-3">Gesendet</th>
                <th className="px-4 py-3">Fehlgeschlagen</th>
                <th className="px-4 py-3">Erfolgsquote</th>
              </tr>
            </thead>
            <tbody>
              {overview.data?.items.map((row) => (
                <tr
                  key={row.tenantId}
                  className="cursor-pointer border-t hover:bg-gray-50"
                  onClick={() => setTenantId(row.tenantId)}
                >
                  <td className="px-4 py-3">{row.tenantName}</td>
                  <td className="px-4 py-3">{row.total}</td>
                  <td className="px-4 py-3">{row.sent}</td>
                  <td className="px-4 py-3">{row.failed}</td>
                  <td className="px-4 py-3">{row.successRate}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {tenantId && (
        <div className="rounded-xl border bg-white p-4">
          <h2 className="text-lg font-semibold">Mandanten-Details</h2>
          <p className="mt-1 text-sm text-gray-600">
            Gesendet: {tenantStats.data?.remindersSentThisPeriod ?? 0}, Fehlgeschlagen: {tenantStats.data?.failedCount ?? 0}
          </p>
          <div className="mt-4 space-y-2">
            {tenantStats.data?.recentReminders.map((log) => (
              <div key={log.id} className="rounded border p-3 text-sm">
                <div className="font-medium">{log.vaccinationType} • {log.emailAddress}</div>
                <div className="text-gray-600">
                  {new Date(log.sentAt).toLocaleString("de-DE")} • {log.status}
                </div>
                {log.error && <div className="text-red-600">{log.error}</div>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border bg-white p-4">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}
