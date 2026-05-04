"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { useTenant } from "@/hooks/useTenant";

export default function VaccinationsPage() {
  const { tenantId } = useTenant();
  const [status, setStatus] = useState<"all" | "overdue" | "due30" | "current">("all");

  const { data: patients } = trpc.patients.list.useQuery(
    { tenantId: tenantId ?? "", limit: 100 },
    { enabled: !!tenantId }
  );

  const rows = useMemo(() => {
    const now = Date.now();
    return (patients ?? []).map((p) => ({
      id: p.id,
      name: p.name,
      species: p.species,
      owner: `${p.ownerFirstName ?? ""} ${p.ownerLastName ?? ""}`.trim(),
      // Placeholder until per-patient aggregation endpoint is added.
      dueAt: null as Date | null,
      state: "current" as "overdue" | "due30" | "current",
      daysUntilDue: null as number | null,
      _now: now,
    }));
  }, [patients]);

  const filtered = rows.filter((row) => status === "all" || row.state === status);

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
        {[
          ["all", "Alle"],
          ["overdue", "Überfällig"],
          ["due30", "In 30 Tagen fällig"],
          ["current", "Aktuell"],
        ].map(([value, label]) => (
          <button
            key={value}
            onClick={() => setStatus(value as typeof status)}
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

      <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-bg text-left text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3">Patient</th>
              <th className="px-4 py-3">Tierart</th>
              <th className="px-4 py-3">Besitzer</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((row) => (
              <tr key={row.id} className="border-t border-border">
                <td className="px-4 py-3">
                  <Link href={`/dashboard/patients/${row.id}`} className="font-medium text-fg hover:underline">
                    {row.name}
                  </Link>
                </td>
                <td className="px-4 py-3 text-muted">{row.species}</td>
                <td className="px-4 py-3 text-muted">{row.owner || "-"}</td>
                <td className="px-4 py-3 text-fg">Aktuell</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td className="px-4 py-8 text-center text-muted" colSpan={4}>
                  Keine Daten vorhanden.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
