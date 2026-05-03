"use client";

import { trpc } from "@/lib/trpc";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";

export default function TenantDetailPage() {
  const params = useParams();
  const router = useRouter();
  const tenantId = params.tenantId as string;

  const [showSuspendDialog, setShowSuspendDialog] = useState(false);
  const [showPlanDialog, setShowPlanDialog] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<
    "free" | "starter" | "pro" | "enterprise"
  >("free");
  const [aiReceptionEnabled, setAiReceptionEnabled] = useState(false);

  const { data: tenant, isLoading, error } =
    trpc.adminDashboard.core.getTenantDetails.useQuery({
      tenantId,
    });

  useEffect(() => {
    if (!tenant) return;
    setAiReceptionEnabled(tenant.featureFlags?.aiReceptionEnabled ?? false);
  }, [tenant]);

  const { data: users } = trpc.adminDashboard.users.listTenantUsers.useQuery({
    tenantId,
  });

  const suspendMutation = trpc.adminDashboard.core.suspendTenant.useMutation({
    onSuccess: () => {
      setShowSuspendDialog(false);
    },
  });

  const unsuspendMutation =
    trpc.adminDashboard.core.unsuspendTenant.useMutation({
      onSuccess: () => {
        router.refresh();
      },
    });

  const updatePlanMutation = trpc.adminDashboard.core.updatePlan.useMutation({
    onSuccess: () => {
      setShowPlanDialog(false);
    },
  });
  const updateFeatureFlagsMutation =
    trpc.adminDashboard.core.updateFeatureFlags.useMutation({
      onError: () => {
        setAiReceptionEnabled(tenant?.featureFlags?.aiReceptionEnabled ?? false);
      },
    });

  if (error) {
    return (
      <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">
        <p className="font-medium">Fehler beim Laden des Mandanten</p>
        <p className="mt-1">{error.message}</p>
      </div>
    );
  }

  if (isLoading || !tenant) {
    return <div className="text-center text-gray-500 py-8">Lädt...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <Link
            href="/dashboard/tenants"
            className="text-blue-600 hover:text-blue-700 text-sm mb-2 inline-block"
          >
            ← Zurück zu Mandanten
          </Link>
          <h2 className="text-2xl font-bold text-gray-900">{tenant.name}</h2>
          <p className="mt-1 text-sm text-gray-500">{tenant.email}</p>
        </div>
        <div
          className={`px-3 py-1 rounded-full text-sm font-semibold ${
            tenant.subscriptionStatus === "active"
              ? "bg-green-100 text-green-800"
              : tenant.subscriptionStatus === "paused"
              ? "bg-yellow-100 text-yellow-800"
              : "bg-red-100 text-red-800"
          }`}
        >
          {tenant.subscriptionStatus}
        </div>
      </div>

      {/* Details Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-xs font-medium text-gray-500 uppercase">Plan</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">
            {tenant.subscriptionPlan}
          </p>
          <button
            onClick={() => {
              setSelectedPlan(
                tenant.subscriptionPlan as
                  | "free"
                  | "starter"
                  | "pro"
                  | "enterprise"
              );
              setShowPlanDialog(true);
            }}
            className="mt-4 text-blue-600 hover:text-blue-700 text-sm font-medium"
          >
            Plan ändern
          </button>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-xs font-medium text-gray-500 uppercase">Nutzer</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">
            {tenant.userCount}
          </p>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-xs font-medium text-gray-500 uppercase">Status</p>
          <p className="mt-2 text-lg font-semibold text-gray-900">
            {tenant.subscriptionStatus === "active" ? (
              <button
                onClick={() => setShowSuspendDialog(true)}
                className="text-red-600 hover:text-red-700"
              >
                Pausieren
              </button>
            ) : (
              <button
                onClick={() => unsuspendMutation.mutate({ tenantId })}
                className="text-green-600 hover:text-green-700"
              >
                Fortsetzen
              </button>
            )}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h3 className="text-sm font-semibold text-gray-900">Feature Flags</h3>
        <p className="mt-1 text-xs text-gray-500">
          Systemweite Schalter für diesen Mandanten.
        </p>

        <div className="mt-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-gray-900">AI Rezeption</p>
            <p className="text-xs text-gray-500">
              Aktiviert den Voice/AI-Rezeptionsbereich für die Praxis.
            </p>
          </div>
          <label className="inline-flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={aiReceptionEnabled}
              onChange={(e) => {
                const nextValue = e.target.checked;
                setAiReceptionEnabled(nextValue);
                updateFeatureFlagsMutation.mutate({
                  tenantId,
                  aiReceptionEnabled: nextValue,
                });
              }}
              disabled={updateFeatureFlagsMutation.isPending}
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            {updateFeatureFlagsMutation.isPending ? "Speichert..." : "Aktiv"}
          </label>
        </div>
      </div>

      {/* Users Section */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-bold text-gray-900">Nutzer ({users?.length || 0})</h3>
        </div>
        {users && users.length > 0 ? (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Rollen
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {users.map((user) => (
                <tr key={user.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {user.firstName} {user.lastName}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {user.email}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <div className="flex flex-wrap gap-1">
                      {user.roles.length > 0 ? (
                        user.roles.map((role) => (
                          <span
                            key={role}
                            className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800"
                          >
                            {role}
                          </span>
                        ))
                      ) : (
                        <span className="text-gray-500">-</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="px-6 py-8 text-center text-gray-500">
            Keine Nutzer gefunden
          </div>
        )}
      </div>

      {/* Dialogs */}
      {showSuspendDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md">
            <h3 className="text-lg font-bold text-gray-900">
              Mandant pausieren?
            </h3>
            <p className="mt-2 text-sm text-gray-600">
              Dieser Mandant wird nicht mehr auf die Anwendung zugreifen können.
            </p>
            <div className="mt-6 flex gap-3 justify-end">
              <button
                onClick={() => setShowSuspendDialog(false)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition"
              >
                Abbrechen
              </button>
              <button
                onClick={() =>
                  suspendMutation.mutate({ tenantId, reason: "Admin suspension" })
                }
                disabled={suspendMutation.isPending}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition disabled:opacity-50"
              >
                {suspendMutation.isPending ? "Wird pausiert..." : "Pausieren"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showPlanDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md">
            <h3 className="text-lg font-bold text-gray-900">Plan ändern</h3>
            <div className="mt-4 space-y-2">
              {(["free", "starter", "pro", "enterprise"] as const).map(
                (planOption) => (
                  <label
                    key={planOption}
                    className="flex items-center p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50"
                  >
                    <input
                      type="radio"
                      name="plan"
                      value={planOption}
                      checked={selectedPlan === planOption}
                      onChange={(e) =>
                        setSelectedPlan(e.target.value as typeof planOption)
                      }
                      className="mr-3"
                    />
                    <span className="text-sm font-medium text-gray-700">
                      {planOption.charAt(0).toUpperCase() + planOption.slice(1)}
                    </span>
                  </label>
                )
              )}
            </div>
            <div className="mt-6 flex gap-3 justify-end">
              <button
                onClick={() => setShowPlanDialog(false)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition"
              >
                Abbrechen
              </button>
              <button
                onClick={() =>
                  updatePlanMutation.mutate({
                    tenantId,
                    plan: selectedPlan,
                  })
                }
                disabled={updatePlanMutation.isPending}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
              >
                {updatePlanMutation.isPending ? "Wird geändert..." : "Ändern"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
