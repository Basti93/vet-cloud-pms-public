"use client";

import Link from "next/link";
import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { useTenant } from "@/hooks/useTenant";
import { TableSkeleton } from "@/components/ui/skeleton";

const STATUS_FILTERS = [
  { value: "all", label: "Alle" },
  { value: "overdue", label: "Überfällig" },
  { value: "due30", label: "In 30 Tagen fällig" },
  { value: "current", label: "Aktuell" },
  { value: "none", label: "Keine Impfungen" },
] as const;

type StatusFilter = (typeof STATUS_FILTERS)[number]["value"];

function StatusBadge({ state }: { state: string }) {
  if (state === "overdue")
    return (
      <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700">
        Überfällig
      </span>
    );
  if (state === "due30")
    return (
      <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700">
        Bald fällig
      </span>
    );
  if (state === "current")
    return (
      <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">
        Aktuell
      </span>
    );
  return (
    <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-muted">
      Keine Impfungen
    </span>
  );
}

export default function VaccinationsPage() {
  const { tenantId } = useTenant();
  const [status, setStatus] = useState<StatusFilter>("all");

  const { data, isLoading, isError } = trpc.vaccinations.getPatientSummaryList.useQuery(
    { tenantId: tenantId ?? "" },
    { enabled: !!tenantId }
  );

  const filtered = (data ?? []).filter(
    (row) => status === "all" || row.state === status
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold text-fg">Impfmanagement</h1>
        <div className="flex gap-2">
          <Link
            href="/dashboard/vaccinations/analytics"
            className="rounded-lg border border-border bg-surface px-3 py-2 text-sm font-medium text-fg hover:bg-muted-soft"
          >
            Analytics
          </Link>
          <Link
            href="/dashboard/settings/vaccinations"
            className="rounded-lg border border-border bg-surface px-3 py-2 text-sm font-medium text-fg hover:bg-muted-soft"
          >
            Einstellungen
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setStatus(value)}
            className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              status === value
                ? "bg-primary text-primary-foreground"
                : "border border-border bg-surface text-fg hover:bg-muted-soft"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {isError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Impfdaten konnten nicht geladen werden. Bitte Seite neu laden.
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
          <table className="min-w-full text-sm">
            <thead className="bg-bg text-left text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3">Patient</th>
                <th className="px-4 py-3">Tierart</th>
                <th className="px-4 py-3">Besitzer</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Nächste Fälligkeit</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="p-0">
                    <TableSkeleton rows={6} />
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td className="px-4 py-8 text-center text-muted" colSpan={5}>
                    {status === "all"
                      ? "Keine Patienten vorhanden."
                      : "Keine Patienten in dieser Kategorie."}
                  </td>
                </tr>
              ) : (
                filtered.map((row) => {
                  const owner = [row.ownerFirstName, row.ownerLastName]
                    .filter(Boolean)
                    .join(" ");
                  const dueDateLabel = row.nextDueAt
                    ? row.nextDueAt.toLocaleDateString("de-DE", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                      })
                    : "—";

                  return (
                    <tr key={row.id} className="border-t border-border hover:bg-bg/50">
                      <td className="px-4 py-3">
                        <Link
                          href={`/dashboard/patients/${row.id}`}
                          className="font-medium text-fg hover:underline"
                        >
                          {row.name}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-muted">{row.species}</td>
                      <td className="px-4 py-3 text-muted">{owner || "—"}</td>
                      <td className="px-4 py-3">
                        <StatusBadge state={row.state} />
                      </td>
                      <td className="px-4 py-3 text-muted">
                        {row.daysUntilDue !== null && row.daysUntilDue <= 30 && row.daysUntilDue >= 0 ? (
                          <span className="text-amber-700">
                            {dueDateLabel} ({row.daysUntilDue}d)
                          </span>
                        ) : row.state === "overdue" ? (
                          <span className="text-red-700">
                            {dueDateLabel} ({Math.abs(row.daysUntilDue ?? 0)}d überfällig)
                          </span>
                        ) : (
                          dueDateLabel
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
