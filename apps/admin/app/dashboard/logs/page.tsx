"use client";

import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { de } from "date-fns/locale";

export default function LogsPage() {
  type LogLevel = "debug" | "info" | "warn" | "error" | "critical";
  const [level, setLevel] = useState<LogLevel | undefined>();
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data, isLoading, error } = trpc.adminDashboard.logs.queryLogs.useQuery(
    {
      level,
      limit: 100,
    },
    {
      refetchInterval: 30000, // Refetch every 30 seconds
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
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Schweregrad
        </label>
        <select
          value={level || ""}
          onChange={(e) => setLevel((e.target.value || undefined) as LogLevel | undefined)}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Alle Schweregrade</option>
          <option value="debug">Debug</option>
          <option value="info">Info</option>
          <option value="warn">Warnung</option>
          <option value="error">Fehler</option>
          <option value="critical">Kritisch</option>
        </select>
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
