"use client";

import { trpc } from "@/lib/trpc";
import { useState } from "react";

export default function DashboardPage() {
  const [hours, setHours] = useState(24);
  const overview = trpc.adminDashboard.core.getTenantOverviewStats.useQuery(
    { hours, limit: 15 },
    { refetchInterval: 30000 }
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">System-Übersicht</h2>
        <p className="mt-1 text-sm text-gray-500">
          Top-Mandanten nach Aktivität, Änderungen und Risikosignalen
        </p>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-4 max-w-sm">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Zeitraum
        </label>
        <select
          value={hours}
          onChange={(e) => setHours(Number(e.target.value))}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value={24}>Letzte 24h</option>
          <option value={72}>Letzte 72h</option>
          <option value={168}>Letzte 7 Tage</option>
        </select>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {overview.isLoading ? (
          <div className="p-8 text-center text-gray-500">Lädt Übersicht...</div>
        ) : !overview.data?.items?.length ? (
          <div className="p-8 text-center text-gray-500">Keine Daten verfügbar</div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Mandant
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Traffic
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Änderungen
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Events
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Fehlerquote
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Risiko
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {overview.data.items.map((tenant) => (
                <tr key={tenant.id} className="hover:bg-gray-50 transition">
                  <td className="px-6 py-4">
                    <p className="text-sm font-medium text-gray-900">{tenant.name}</p>
                    <p className="text-xs text-gray-500">{tenant.slug}</p>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-700">{tenant.trafficCount}</td>
                  <td className="px-6 py-4 text-sm text-gray-700">{tenant.changeCount}</td>
                  <td className="px-6 py-4 text-sm text-gray-700">{tenant.eventsCount}</td>
                  <td className="px-6 py-4 text-sm text-gray-700">{tenant.errorRate}%</td>
                  <td className="px-6 py-4 text-sm">
                    {tenant.suspicious ? (
                      <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">
                        Auffällig
                      </span>
                    ) : (
                      <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                        Normal
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
