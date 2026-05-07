"use client";

import Link from "next/link";
import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { useTenant } from "@/hooks/useTenant";
import { Skeleton, TableSkeleton } from "@/components/ui/skeleton";
import { ArrowRight, CheckCircle, Clock, Mail, MailX, TrendingUp, XCircle } from "lucide-react";

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

function CategoryDot({ category }: { category: string | null }) {
  if (category === "core")
    return <span className="inline-block h-1.5 w-1.5 rounded-full bg-blue-500" title="Pflichtimpfung" />;
  if (category === "recommended")
    return <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-400" title="Empfohlen" />;
  return null;
}

export default function VaccinationsPage() {
  const { tenantId } = useTenant();
  const [status, setStatus] = useState<StatusFilter>("all");

  const { data: scanStats, isLoading: statsLoading } =
    trpc.vaccinations.getScanStats.useQuery(
      { tenantId: tenantId ?? "" },
      { enabled: !!tenantId }
    );

  const { data: reminderStats, isLoading: reminderStatsLoading } =
    trpc.vaccinations.getReminderStats.useQuery(
      { tenantId: tenantId ?? "" },
      { enabled: !!tenantId }
    );

  const { data, isLoading, isError } =
    trpc.vaccinations.getPatientSummaryList.useQuery(
      { tenantId: tenantId ?? "", hideOptOut: true },
      { enabled: !!tenantId }
    );

  const filtered = (data ?? []).filter(
    (row) => status === "all" || row.state === status
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold text-fg">Impfmanagement</h1>
        <Link
          href="/dashboard/settings/vaccinations"
          className="rounded-lg border border-border bg-surface px-3 py-2 text-sm font-medium text-fg hover:bg-muted-soft"
        >
          Einstellungen
        </Link>
      </div>

      {/* Impfstatus — patient health row */}
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "Gesamt erfasst", value: scanStats?.totalTracked, color: "text-fg" },
          { label: "Überfällig", value: scanStats?.totalDue, color: "text-red-600" },
          { label: "In 30 Tagen fällig", value: scanStats?.totalUpcoming, color: "text-amber-600" },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
            <p className="text-sm text-muted">{label}</p>
            {statsLoading ? (
              <Skeleton className="mt-2 h-8 w-16" />
            ) : (
              <p className={`mt-1 text-2xl font-semibold ${color}`}>{value ?? 0}</p>
            )}
          </div>
        ))}
      </div>

      {/* E-Mail-Erinnerungen — reminder monitoring row */}
      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">
          E-Mail-Erinnerungen
        </p>
        <div className="grid gap-4 sm:grid-cols-3">
          {/* Sent */}
          <div className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
            <div className="flex items-center gap-2 text-sm text-muted">
              <Mail className="h-3.5 w-3.5" />
              Gesendet
            </div>
            {reminderStatsLoading ? (
              <Skeleton className="mt-2 h-8 w-16" />
            ) : (
              <>
                <p className="mt-1 text-2xl font-semibold text-fg">
                  {reminderStats?.sent ?? 0}
                </p>
                {(reminderStats?.sent ?? 0) + (reminderStats?.failed ?? 0) > 0 && (
                  <p className="mt-0.5 text-xs text-muted">
                    {reminderStats?.successRate ?? 0}% Erfolgsquote
                  </p>
                )}
              </>
            )}
          </div>

          {/* Failed */}
          <div className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
            <div className="flex items-center gap-2 text-sm text-muted">
              <XCircle className="h-3.5 w-3.5" />
              Fehlgeschlagen
            </div>
            {reminderStatsLoading ? (
              <Skeleton className="mt-2 h-8 w-16" />
            ) : (
              <p
                className={`mt-1 text-2xl font-semibold ${
                  (reminderStats?.failed ?? 0) > 0 ? "text-red-600" : "text-fg"
                }`}
              >
                {reminderStats?.failed ?? 0}
              </p>
            )}
          </div>

          {/* Conversion */}
          <div className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
            <div className="flex items-center gap-2 text-sm text-muted">
              <TrendingUp className="h-3.5 w-3.5" />
              Terminkonversionen
            </div>
            {reminderStatsLoading ? (
              <Skeleton className="mt-2 h-8 w-16" />
            ) : (
              <>
                <p className="mt-1 text-2xl font-semibold text-fg">
                  {reminderStats?.conversions ?? 0}
                </p>
                {(reminderStats?.sent ?? 0) > 0 && (
                  <p className="mt-0.5 text-xs text-muted">
                    {reminderStats?.conversionRate ?? 0}% der Erinnerungen
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Legend + note */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-muted">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-blue-500" />
          Pflichtimpfung (Core)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-400" />
          Empfohlen
        </span>
        <span className="flex items-center gap-1.5">
          <CheckCircle className="h-3.5 w-3.5 text-green-500" />
          Erinnerung gesendet
        </span>
        <span className="flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5 text-amber-500" />
          Erinnerung ausstehend
        </span>
        <span className="ml-auto flex items-center gap-1.5">
          <MailX className="h-3.5 w-3.5 text-muted" />
          Opt-out-Besitzer werden nicht angezeigt
        </span>
      </div>

      {/* Status filters */}
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

      {/* Table */}
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
                <th className="px-4 py-3">Fällige Impfungen</th>
                <th className="px-4 py-3">E-Mail-Erinnerung</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="p-0">
                    <TableSkeleton rows={6} />
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td className="px-4 py-8 text-center text-muted" colSpan={7}>
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

                  const now = new Date();
                  const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

                  // Only show actionable vaccinations in the detail column
                  const actionableVacs = row.vaccinations.filter((v) => {
                    if (!v.expiryDate) return false;
                    return v.expiryDate <= in30Days; // overdue or due soon
                  });

                  // Reminder status: any unsent reminders for actionable vacs?
                  const unsentCount = actionableVacs.filter((v) => !v.reminderSentDate).length;
                  const sentCount = actionableVacs.filter((v) => !!v.reminderSentDate).length;

                  return (
                    <tr key={row.id} className="border-t border-border hover:bg-bg/50">
                      <td className="px-4 py-3">
                        <Link
                          href={`/dashboard/patients/${row.id}#impfhistorie`}
                          className="font-medium text-fg hover:underline"
                        >
                          {row.name}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-muted">{row.species}</td>
                      <td className="px-4 py-3">
                        <span className="text-muted">{owner || "—"}</span>
                        {row.ownerEmail && (
                          <a
                            href={`mailto:${row.ownerEmail}`}
                            className="block text-xs text-primary hover:underline mt-0.5"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {row.ownerEmail}
                          </a>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge state={row.state} />
                      </td>

                      {/* Vaccination types column */}
                      <td className="px-4 py-3">
                        {actionableVacs.length === 0 ? (
                          <span className="text-muted">—</span>
                        ) : (
                          <div className="flex flex-col gap-1">
                            {actionableVacs.map((v) => {
                              const expiry = v.expiryDate
                                ? v.expiryDate.toLocaleDateString("de-DE", {
                                    day: "2-digit",
                                    month: "2-digit",
                                    year: "numeric",
                                  })
                                : "—";
                              const isOverdue = v.expiryDate && v.expiryDate < now;
                              return (
                                <span
                                  key={v.id}
                                  className="flex items-center gap-1.5 text-xs"
                                >
                                  <CategoryDot category={v.category} />
                                  <span className={isOverdue ? "text-red-600" : "text-fg"}>
                                    {v.typeName}
                                  </span>
                                  <span className="text-muted">({expiry})</span>
                                </span>
                              );
                            })}
                          </div>
                        )}
                      </td>

                      {/* Reminder status column */}
                      <td className="px-4 py-3">
                        {actionableVacs.length === 0 ? (
                          <span className="text-muted">—</span>
                        ) : unsentCount === 0 ? (
                          <span className="flex items-center gap-1.5 text-xs text-green-600">
                            <CheckCircle className="h-3.5 w-3.5" />
                            Erinnerung gesendet
                          </span>
                        ) : sentCount === 0 ? (
                          <span className="flex items-center gap-1.5 text-xs text-amber-600">
                            <Clock className="h-3.5 w-3.5" />
                            Noch keine Erinnerung gesendet
                          </span>
                        ) : (
                          <span className="flex items-center gap-1.5 text-xs text-amber-600">
                            <Clock className="h-3.5 w-3.5" />
                            {unsentCount} von {actionableVacs.length} noch nicht erinnert
                          </span>
                        )}
                      </td>

                      {/* Explicit details link */}
                      <td className="px-4 py-3">
                        <Link
                          href={`/dashboard/patients/${row.id}#impfhistorie`}
                          className="inline-flex items-center gap-1 whitespace-nowrap rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs font-medium text-fg hover:bg-muted-soft"
                        >
                          Details
                          <ArrowRight className="h-3 w-3" />
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Reminder note */}
      <p className="text-xs text-muted">
        Erinnerungen werden täglich automatisch versendet — gebündelt pro Besitzer,
        sobald eine Impfung innerhalb der konfigurierten Frist fällig ist.
        Nur Pflicht- und empfohlene Impfungen werden standardmäßig erinnert.{" "}
        <Link href="/dashboard/settings/vaccinations" className="underline hover:text-fg">
          Einstellungen anpassen
        </Link>
      </p>
    </div>
  );
}
