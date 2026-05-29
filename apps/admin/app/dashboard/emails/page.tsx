"use client";

import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { de } from "date-fns/locale";

type EmailType =
  | "confirmation" | "reminder" | "booking_request" | "booking_notification"
  | "invitation" | "account_deletion" | "tenant_deactivation" | "tenant_lifecycle"
  | "payment_failed" | "trial_ending" | "trial_expired"
  | "vaccination_reminder" | "vaccination_digest" | "consultation_request";

const EMAIL_TYPE_LABELS: Record<string, string> = {
  confirmation: "Terminbestätigung",
  reminder: "Terminerinnerung",
  booking_request: "Buchungsanfrage",
  booking_notification: "Buchungsbenachrichtigung",
  invitation: "Einladung",
  account_deletion: "Kontolöschung",
  tenant_deactivation: "Praxis deaktiviert",
  tenant_lifecycle: "Praxis-Lifecycle",
  payment_failed: "Zahlung fehlgeschlagen",
  trial_ending: "Testphase endet",
  trial_expired: "Testphase abgelaufen",
  vaccination_reminder: "Impf-Erinnerung",
  vaccination_digest: "Impf-Digest",
  consultation_request: "Beratungsanfrage",
};

type EmailStatus = "sent" | "failed";

function MetricCard({ title, value, tone }: { title: string; value: string; tone?: "green" | "red" }) {
  const valueColor = tone === "green" ? "text-green-600" : tone === "red" ? "text-red-600" : "text-gray-900";
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <p className="text-sm text-gray-500">{title}</p>
      <p className={`mt-1 text-2xl font-bold ${valueColor}`}>{value}</p>
    </div>
  );
}

export default function EmailLogsPage() {
  const [status, setStatus] = useState<EmailStatus | undefined>();
  const [emailType, setEmailType] = useState<string | undefined>();
  const [hours, setHours] = useState(24);

  const { data: summary, isLoading: summaryLoading } =
    trpc.adminDashboard.emailLogs.getAdminSummary.useQuery(
      { hours },
      { refetchInterval: 300_000, refetchOnWindowFocus: false }
    );

  const { data, isLoading } = trpc.adminDashboard.emailLogs.listAdmin.useQuery(
    {
      status,
      emailType: emailType as EmailType | undefined,
      limit: 100,
    },
    { refetchInterval: 300_000, refetchOnWindowFocus: false }
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">E-Mail Log</h2>
        <p className="mt-1 text-sm text-gray-500">Alle gesendeten E-Mails — alle Typen, alle Mandanten</p>
      </div>

      <div className="grid grid-cols-1 gap-4 rounded-lg border border-gray-200 bg-white p-4 md:grid-cols-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Zeitraum</label>
          <select
            value={hours}
            onChange={(e) => setHours(Number(e.target.value))}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value={24}>Letzte 24h</option>
            <option value={48}>Letzte 48h</option>
            <option value={168}>Letzte 7 Tage</option>
            <option value={720}>Letzte 30 Tage</option>
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Status</label>
          <select
            value={status || ""}
            onChange={(e) => setStatus((e.target.value || undefined) as EmailStatus | undefined)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Alle</option>
            <option value="sent">Gesendet</option>
            <option value="failed">Fehlgeschlagen</option>
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Typ</label>
          <select
            value={emailType || ""}
            onChange={(e) => setEmailType(e.target.value || undefined)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Alle Typen</option>
            {Object.entries(EMAIL_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <MetricCard title="Gesamt" value={summaryLoading ? "…" : String(summary?.total ?? 0)} />
        <MetricCard title="Gesendet" value={summaryLoading ? "…" : String(summary?.sent ?? 0)} tone="green" />
        <MetricCard title="Fehlgeschlagen" value={summaryLoading ? "…" : String(summary?.failed ?? 0)} tone="red" />
        <MetricCard title="Erfolgsrate" value={summaryLoading ? "…" : `${summary?.successRate ?? 0}%`} />
      </div>

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        {isLoading ? (
          <div className="p-8 text-center text-gray-500">Lädt E-Mail-Logs…</div>
        ) : !data?.items?.length ? (
          <div className="p-8 text-center text-gray-500">Keine E-Mail-Logs gefunden</div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {["Zeitpunkt", "Mandant", "Typ", "Empfänger", "Status", "Fehler"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {data.items.map((item) => (
                <tr key={item.id} className={item.status === "failed" ? "bg-red-50" : undefined}>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">
                    {formatDistanceToNow(new Date(item.sentAt), { addSuffix: true, locale: de })}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    {item.tenantName ?? <span className="text-gray-400">System</span>}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    {EMAIL_TYPE_LABELS[item.emailType] ?? item.emailType}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">{item.recipientEmail}</td>
                  <td className="px-4 py-3 text-sm">
                    {item.status === "sent" ? (
                      <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">Gesendet</span>
                    ) : (
                      <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">Fehler</span>
                    )}
                  </td>
                  <td className="max-w-xs truncate px-4 py-3 text-xs text-red-600">
                    {item.errorMessage ?? "—"}
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
