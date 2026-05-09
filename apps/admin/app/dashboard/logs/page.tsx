"use client";

import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { de } from "date-fns/locale";

export default function LogsPage() {
  type LogLevel = "debug" | "info" | "warn" | "error" | "critical";
  const [level, setLevel] = useState<LogLevel | undefined>();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [tenantId, setTenantId] = useState<string | undefined>();
  const [hours, setHours] = useState(24);

  const tenants = trpc.adminDashboard.core.listTenants.useQuery(
    { limit: 100 },
    {
      refetchInterval: 600_000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
    }
  );

  const summary = trpc.adminDashboard.logs.getSummary.useQuery(
    { hours, tenantId },
    {
      refetchInterval: 300_000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
    }
  );

  const { data, isLoading, error } = trpc.adminDashboard.logs.queryLogs.useQuery(
    {
      level,
      tenantId,
      limit: 50,
    },
    {
      refetchInterval: 300_000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
    }
  );

  const getLogDetails = trpc.adminDashboard.logs.getLogDetails.useQuery(
    { logId: expanded! },
    { enabled: !!expanded }
  );

  const getLevelBadgeColor = (
    level: string
  ): "bg-red-100 text-red-800" | "bg-yellow-100 text-yellow-800" | "bg-blue-100 text-blue-800" => {
    switch (level) {
      case "error":
        return "bg-red-100 text-red-800";
      case "warn":
        return "bg-yellow-100 text-yellow-800";
      default:
        return "bg-blue-100 text-blue-800";
    }
  };

  if (error) {
    return (
      <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">
        <p className="font-medium">Fehler beim Laden der Protokolle</p>
        <p className="mt-1">{error.message}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Fehlerprotokoll</h2>
        <p className="mt-1 text-sm text-gray-500">
          Systemereignisse und Fehlerprotokolle
        </p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
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
            Schweregrad
          </label>
          <select
            value={level || ""}
            onChange={(e) => setLevel((e.target.value || undefined) as LogLevel | undefined)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Alle Schweregrade</option>
            <option value="debug">Debug</option>
            <option value="info">Info</option>
            <option value="warn">Warnung</option>
            <option value="error">Fehler</option>
            <option value="critical">Kritisch</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <MetricCard title="Events gesamt" value={String(summary.data?.total ?? 0)} />
        <MetricCard title="Warnungen" value={String(summary.data?.warnCount ?? 0)} />
        <MetricCard title="Fehler" value={String(summary.data?.errorCount ?? 0)} />
        <MetricCard title="Kritisch" value={String(summary.data?.criticalCount ?? 0)} />
      </div>

      {/* Logs List */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-500">
            Lädt Protokolle...
          </div>
        ) : !data?.items?.length ? (
          <div className="p-8 text-center text-gray-500">
            Keine Protokolle gefunden
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {data.items.map((log) => (
              <div
                key={log.id}
                className="p-4 hover:bg-gray-50 transition cursor-pointer"
              >
                <div className="flex items-start gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <span
                        className={`px-2 py-1 text-xs font-semibold rounded-full ${getLevelBadgeColor(
                          log.level
                        )}`}
                      >
                        {log.level.toUpperCase()}
                      </span>
                      <span className="font-medium text-gray-900">
                        {log.eventType}
                      </span>
                      <span className="text-xs text-gray-500">
                        {formatDistanceToNow(new Date(log.timestamp), {
                          locale: de,
                          addSuffix: true,
                        })}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-gray-600">{log.message}</p>
                    {log.tenantId && (
                      <p className="mt-1 text-xs text-gray-500">
                        Mandant: {log.tenantId}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() =>
                      setExpanded(expanded === log.id ? null : log.id)
                    }
                    className="text-blue-600 hover:text-blue-700 text-sm font-medium whitespace-nowrap"
                  >
                    {expanded === log.id ? "Einklappen" : "Details"}
                  </button>
                </div>

                {/* Expanded Details */}
                {expanded === log.id && getLogDetails.data && (
                  <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200 text-xs font-mono text-gray-700 overflow-x-auto">
                    <div className="mb-2">
                      <strong>Nachricht:</strong> {getLogDetails.data.message}
                    </div>
                    {getLogDetails.data.errorStack && (
                      <div>
                        <strong>Stack Trace:</strong>
                        <pre className="mt-2 text-red-600 whitespace-pre-wrap">
                          {getLogDetails.data.errorStack}
                        </pre>
                      </div>
                    )}
                    {getLogDetails.data.metadata && (
                      <div className="mt-2">
                        <strong>Metadaten:</strong>
                        <pre className="mt-2 text-gray-600 whitespace-pre-wrap">
                          {JSON.stringify(
                            getLogDetails.data.metadata,
                            null,
                            2
                          )}
                        </pre>
                      </div>
                    )}
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
