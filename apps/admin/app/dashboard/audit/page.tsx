"use client";

import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { de } from "date-fns/locale";

export default function AuditPage() {
  type AuditAction = "create" | "update" | "delete" | "export" | "access";
  const [action, setAction] = useState<AuditAction | undefined>();
  const [entityType, setEntityType] = useState("");
  const [hours, setHours] = useState(24);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tenantId, setTenantId] = useState<string | undefined>();

  const tenants = trpc.adminDashboard.core.listTenants.useQuery(
    { limit: 200 },
    { refetchInterval: 60000 }
  );

  const {
    data: summary,
    isLoading: summaryLoading,
    error: summaryError,
  } = trpc.adminDashboard.audit.getSummary.useQuery(
    { hours, tenantId },
    { refetchInterval: 30000 }
  );

  const { data, isLoading, error } = trpc.adminDashboard.audit.list.useQuery(
    {
      action,
      tenantId,
      entityType: entityType || undefined,
      limit: 150,
    },
    {
      refetchInterval: 30000,
    }
  );

  const details = trpc.adminDashboard.audit.getDetails.useQuery(
    { auditId: selectedId! },
    { enabled: !!selectedId }
  );

  if (summaryError || error) {
    return (
      <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">
        <p className="font-medium">Fehler beim Laden des Audit-Logs</p>
        <p className="mt-1">{summaryError?.message || error?.message}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Audit-Log</h2>
        <p className="mt-1 text-sm text-gray-500">
          Nachvollziehbarkeit von Datenänderungen (DSGVO) mit KPI-Übersicht
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
            <option value={72}>Letzte 72h</option>
            <option value={168}>Letzte 7 Tage</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Mandant
          </label>
          <select
            value={tenantId || ""}
            onChange={(e) => setTenantId(e.target.value || undefined)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Alle Mandanten</option>
            {(tenants.data?.items ?? []).map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Aktion
          </label>
          <select
            value={action || ""}
            onChange={(e) => setAction((e.target.value || undefined) as AuditAction | undefined)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Alle Aktionen</option>
            <option value="create">create</option>
            <option value="update">update</option>
            <option value="delete">delete</option>
            <option value="export">export</option>
            <option value="access">access</option>
            <option value="config_change">config_change</option>
            <option value="permission_change">permission_change</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Entity Type
          </label>
          <input
            type="text"
            value={entityType}
            onChange={(e) => setEntityType(e.target.value)}
            placeholder="z.B. patient, appointment, tenant"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <MetricCard title="Events gesamt" value={summaryLoading ? "…" : String(summary?.total ?? 0)} />
        <MetricCard title="Änderungen" value={summaryLoading ? "…" : String((summary?.createCount ?? 0) + (summary?.updateCount ?? 0) + (summary?.deleteCount ?? 0))} />
        <MetricCard title="Exporte" value={summaryLoading ? "…" : String(summary?.exportCount ?? 0)} />
        <MetricCard title="Aktive Nutzer" value={summaryLoading ? "…" : String(summary?.distinctUsers ?? 0)} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-900">Top Aktionen</h3>
          <div className="mt-3 space-y-2">
            {(summary?.topActions ?? []).map((a) => (
              <div key={a.action} className="flex items-center justify-between text-sm">
                <span className="text-gray-700">{a.action}</span>
                <span className="font-semibold text-gray-900">{a.count}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-900">Top Entities</h3>
          <div className="mt-3 space-y-2">
            {(summary?.topEntityTypes ?? []).map((e) => (
              <div key={e.entityType} className="flex items-center justify-between text-sm">
                <span className="text-gray-700">{e.entityType}</span>
                <span className="font-semibold text-gray-900">{e.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-500">Lädt Audit-Einträge...</div>
        ) : !data?.items?.length ? (
          <div className="p-8 text-center text-gray-500">Keine Audit-Einträge gefunden</div>
        ) : (
          <div className="divide-y divide-gray-200">
            {data.items.map((item) => (
              <div key={item.id} className="p-4 hover:bg-gray-50 transition">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <p className="text-sm">
                      <span className="font-semibold text-gray-900">{item.action}</span>
                      <span className="text-gray-500"> · {item.entityType}</span>
                    </p>
                    <p className="text-xs text-gray-500">
                      Mandant: {item.tenantName || item.tenantId}
                    </p>
                    <p className="text-xs text-gray-500">Entity ID: {item.entityId}</p>
                    <p className="text-xs text-gray-500">
                      {formatDistanceToNow(new Date(item.createdAt), {
                        locale: de,
                        addSuffix: true,
                      })}
                    </p>
                  </div>
                  <button
                    onClick={() => setSelectedId(selectedId === item.id ? null : item.id)}
                    className="text-blue-600 hover:text-blue-700 text-sm font-medium whitespace-nowrap"
                  >
                    {selectedId === item.id ? "Einklappen" : "Details"}
                  </button>
                </div>
                {selectedId === item.id && details.data && (
                  <div className="mt-3 rounded border border-gray-200 bg-gray-50 p-3 text-xs text-gray-700 space-y-2">
                    <p><strong>IP:</strong> {details.data.ipAddress || "—"}</p>
                    <p><strong>User-Agent:</strong> {details.data.userAgent || "—"}</p>
                    <pre className="overflow-x-auto whitespace-pre-wrap">
                      {JSON.stringify(details.data.changes, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function MetricCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <p className="text-sm text-gray-500">{title}</p>
      <p className="mt-1 text-2xl font-bold text-gray-900">{value}</p>
    </div>
  );
}
