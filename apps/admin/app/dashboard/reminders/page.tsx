"use client";

import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { de } from "date-fns/locale";

export default function RemindersPage() {
  type ReminderStatus = "sent" | "failed";
  const [status, setStatus] = useState<ReminderStatus | undefined>();
  const [hours, setHours] = useState(24);

  const { data: summary, isLoading: summaryLoading, error: summaryError } =
    trpc.adminDashboard.reminders.getSummary.useQuery(
      { hours },
      { refetchInterval: 30000 }
    );

  const { data, isLoading, error } = trpc.adminDashboard.reminders.listLogs.useQuery(
    {
      status,
      limit: 100,
    },
    {
      refetchInterval: 30000,
    }
  );

  if (summaryError || error) {
    return (
      <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">
        <p className="font-medium">Fehler beim Laden der Reminder-Daten</p>
        <p className="mt-1">{summaryError?.message || error?.message}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Reminder E-Mails</h2>
        <p className="mt-1 text-sm text-gray-500">
          Zustellung und Fehler bei Termin-Erinnerungen
        </p>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-4 grid grid-cols-1 md:grid-cols-4 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Zeitraum
          </label>
          <select
            value={hours}
            onChange={(e) => setHours(Number(e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value={24}>Letzte 24h</option>
            <option value={48}>Letzte 48h</option>
            <option value={168}>Letzte 7 Tage</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Statusfilter
          </label>
          <select
            value={status || ""}
            onChange={(e) =>
              setStatus((e.target.value || undefined) as ReminderStatus | undefined)
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Alle</option>
            <option value="sent">Gesendet</option>
            <option value="failed">Fehlgeschlagen</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <MetricCard
          title="Gesamt"
          value={summaryLoading ? "…" : String(summary?.total ?? 0)}
        />
        <MetricCard
          title="Gesendet"
          value={summaryLoading ? "…" : String(summary?.sent ?? 0)}
          tone="green"
        />
        <MetricCard
          title="Fehlgeschlagen"
          value={summaryLoading ? "…" : String(summary?.failed ?? 0)}
          tone="red"
        />
        <MetricCard
          title="Erfolgsrate"
          value={summaryLoading ? "…" : `${summary?.successRate ?? 0}%`}
        />
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-500">
            Lädt Reminder-Logs...
          </div>
        ) : !data?.items?.length ? (
          <div className="p-8 text-center text-gray-500">
            Keine Reminder-Logs gefunden
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Zeitpunkt
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Mandant
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Empfänger
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Fehler
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {data.items.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50 transition">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {formatDistanceToNow(new Date(item.sentAt), {
                      locale: de,
                      addSuffix: true,
                    })}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {item.tenantName}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {item.recipientEmail}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span
                      className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        item.status === "sent"
                          ? "bg-green-100 text-green-800"
                          : "bg-red-100 text-red-800"
                      }`}
                    >
                      {item.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600 max-w-md truncate">
                    {item.errorMessage || "—"}
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

function MetricCard({
  title,
  value,
  tone = "default",
}: {
  title: string;
  value: string;
  tone?: "default" | "green" | "red";
}) {
  const toneClass =
    tone === "green"
      ? "text-green-700"
      : tone === "red"
      ? "text-red-700"
      : "text-gray-900";
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <p className="text-sm text-gray-500">{title}</p>
      <p className={`mt-1 text-2xl font-bold ${toneClass}`}>{value}</p>
    </div>
  );
}

