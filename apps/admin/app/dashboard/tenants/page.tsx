"use client";

import { trpc } from "@/lib/trpc";
import { useState } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { de } from "date-fns/locale";

export default function TenantsPage() {
  type TenantPlan = "free" | "starter" | "pro" | "enterprise";
  type TenantStatus = "trial" | "active" | "paused" | "cancelled";
  const [search, setSearch] = useState("");
  const [plan, setPlan] = useState<TenantPlan | undefined>();
  const [status, setStatus] = useState<TenantStatus | undefined>();

  const { data, isLoading, error } = trpc.adminDashboard.core.listTenants.useQuery(
    {
      search: search || undefined,
      plan,
      status,
      limit: 50,
    },
    {
      refetchInterval: 300_000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
    }
  );
  const utils = trpc.useUtils();
  const scheduleDeletion = trpc.adminDashboard.core.scheduleTenantDeletion.useMutation({
    onSuccess: async () => {
      await utils.adminDashboard.core.listTenants.invalidate();
    },
  });
  const cancelDeletion = trpc.adminDashboard.core.cancelTenantDeletion.useMutation({
    onSuccess: async () => {
      await utils.adminDashboard.core.listTenants.invalidate();
    },
  });
  const debugHardDelete = trpc.adminDashboard.core.debugHardDeleteNow.useMutation({
    onSuccess: async () => {
      await utils.adminDashboard.core.listTenants.invalidate();
    },
  });
  const showDebugHardDelete = process.env.NODE_ENV !== "production";

  if (error) {
    return (
      <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">
        <p className="font-medium">Fehler beim Laden der Mandanten</p>
        <p className="mt-1">{error.message}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Mandanten</h2>
        <p className="mt-1 text-sm text-gray-500">
          Verwalten Sie alle Mandanten und deren Einstellungen
        </p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Suche
          </label>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Mandantenname..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Plan
          </label>
          <select
            value={plan || ""}
            onChange={(e) => setPlan((e.target.value || undefined) as TenantPlan | undefined)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Alle Pläne</option>
            <option value="free">Kostenlos</option>
            <option value="starter">Starter</option>
            <option value="pro">Pro</option>
            <option value="enterprise">Enterprise</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Status
          </label>
          <select
            value={status || ""}
            onChange={(e) =>
              setStatus((e.target.value || undefined) as TenantStatus | undefined)
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Alle Status</option>
            <option value="trial">Testphase</option>
            <option value="active">Aktiv</option>
            <option value="paused">Pausiert</option>
            <option value="cancelled">Gekündigt</option>
          </select>
        </div>
      </div>

      {/* Tenant List */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-500">
            Lädt Mandanten...
          </div>
        ) : !data?.items?.length ? (
          <div className="p-8 text-center text-gray-500">
            Keine Mandanten gefunden
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Plan
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Nutzer
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Erstellt
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Aktionen
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {data.items.map((tenant) => (
                <tr key={tenant.id} className="hover:bg-gray-50 transition">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {tenant.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                      {tenant.plan}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span
                      className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        tenant.status === "active"
                          ? "bg-green-100 text-green-800"
                          : tenant.status === "paused"
                          ? "bg-yellow-100 text-yellow-800"
                          : "bg-red-100 text-red-800"
                      }`}
                    >
                      {tenant.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {tenant.userCount}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {formatDistanceToNow(new Date(tenant.createdAt), {
                      locale: de,
                      addSuffix: true,
                    })}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <div className="flex flex-col gap-2">
                      <Link
                        href={`/dashboard/tenants/${tenant.id}`}
                        className="text-blue-600 hover:text-blue-700 font-medium"
                      >
                        Details
                      </Link>
                      {tenant.deletionStatus === "scheduled" && tenant.deletionScheduledFor ? (
                        <>
                          <span className="inline-flex w-fit rounded-full bg-red-100 px-2 py-1 text-xs font-semibold text-red-800">
                            Löschung geplant:{" "}
                            {new Date(tenant.deletionScheduledFor).toLocaleDateString("de-DE")}
                          </span>
                          <button
                            type="button"
                            onClick={() => cancelDeletion.mutate({ tenantId: tenant.id })}
                            className="w-fit rounded border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                            disabled={cancelDeletion.isPending}
                          >
                            Löschung abbrechen
                          </button>
                          {showDebugHardDelete && (
                            <button
                              type="button"
                              onClick={() => {
                                const confirmText = window.prompt(
                                  `Debug-Hard-Delete jetzt? Bitte exakt eingeben: DELETE NOW ${tenant.slug}`
                                );
                                if (!confirmText) return;
                                debugHardDelete.mutate({
                                  tenantId: tenant.id,
                                  confirmationText: confirmText,
                                });
                              }}
                              className="w-fit rounded border border-amber-300 px-2 py-1 text-xs font-semibold text-amber-800 hover:bg-amber-50"
                              disabled={debugHardDelete.isPending}
                            >
                              {debugHardDelete.isPending
                                ? "Hard-Delete läuft..."
                                : "Debug: Jetzt endgültig löschen"}
                            </button>
                          )}
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            const confirmText = window.prompt(
                              `Zum Planen der Löschung bitte exakt eingeben: DELETE ${tenant.slug}`
                            );
                            if (!confirmText) return;
                            scheduleDeletion.mutate({
                              tenantId: tenant.id,
                              confirmationText: confirmText,
                              reason: "Scheduled by system admin",
                            });
                          }}
                          className="w-fit rounded border border-red-300 px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-50"
                          disabled={scheduleDeletion.isPending}
                        >
                          Löschen planen (+30 Tage)
                        </button>
                      )}
                    </div>
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
