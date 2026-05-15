"use client";

import { trpc } from "@/lib/trpc";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
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
  const [aiReceptionOverride, setAiReceptionOverride] = useState<boolean | null>(null);
  const [systemRolesEditableOverride, setSystemRolesEditableOverride] = useState<boolean | null>(null);
  const [copiedPreview, setCopiedPreview] = useState(false);

  const { data: tenant, isLoading, error } =
    trpc.adminDashboard.core.getTenantDetails.useQuery({
      tenantId,
    });

  const { data: users } = trpc.adminDashboard.users.listTenantUsers.useQuery({
    tenantId,
  });

  const aiReceptionEnabled = aiReceptionOverride ?? (tenant?.featureFlags?.aiReceptionEnabled ?? false);
  const systemRolesEditable = systemRolesEditableOverride ?? Boolean(tenant?.systemRolesEditable);

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
        setAiReceptionOverride(null);
      },
    });
  const setSystemRolesEditableMutation =
    trpc.adminDashboard.core.setSystemRolesEditable.useMutation({
      onError: () => {
        setSystemRolesEditableOverride(null);
      },
    });

  const utils = trpc.useUtils();
  const generatePreviewTokenMutation = trpc.adminDashboard.core.generatePreviewToken.useMutation({
    onSuccess: () => utils.adminDashboard.core.getTenantDetails.invalidate({ tenantId }),
  });
  const toggleWebsiteEnabledMutation = trpc.adminDashboard.core.toggleWebsiteEnabled.useMutation({
    onSuccess: () => utils.adminDashboard.core.getTenantDetails.invalidate({ tenantId }),
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
              : tenant.subscriptionStatus === "trial"
              ? "bg-blue-100 text-blue-800"
              : tenant.subscriptionStatus === "paused"
              ? "bg-yellow-100 text-yellow-800"
              : "bg-red-100 text-red-800"
          }`}
        >
          {tenant.subscriptionStatus === "trial"
            ? "Testphase"
            : tenant.subscriptionStatus === "active"
            ? "Aktiv"
            : tenant.subscriptionStatus === "paused"
            ? "Pausiert"
            : tenant.subscriptionStatus}
        </div>
      </div>

      {/* Details Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-xs font-medium text-gray-500 uppercase">Tarif</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">
            {tenant.currentPriceLabel
              ? `${tenant.currentPriceLabel.seats} Nutzer`
              : tenant.subscriptionPlan}
          </p>
          <p className="text-xs text-gray-500">
            {tenant.currentPriceLabel
              ? `€${(tenant.currentPriceLabel.monthlyPrice / 100).toFixed(2)}/Monat`
              : ""}
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
          <p className="text-xs font-medium text-gray-500 uppercase">Nutzerplätze</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">
            {tenant.userCount} / {tenant.maxUsers ?? "—"}
          </p>
          <p className="text-xs text-gray-500">
            {tenant.maxUsers && tenant.userCount >= tenant.maxUsers
              ? "Alle Plätze belegt"
              : tenant.maxUsers
              ? `${(tenant.maxUsers ?? 0) - tenant.userCount} verfügbar`
              : ""}
          </p>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-xs font-medium text-gray-500 uppercase">Status</p>
          <p className="mt-2 text-lg font-semibold">
            <span
              className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                tenant.subscriptionStatus === "active"
                  ? "bg-green-100 text-green-800"
                  : tenant.subscriptionStatus === "trial"
                  ? "bg-blue-100 text-blue-800"
                  : tenant.subscriptionStatus === "paused"
                  ? "bg-yellow-100 text-yellow-800"
                  : "bg-red-100 text-red-800"
              }`}
            >
              {tenant.subscriptionStatus === "trial"
                ? "Testphase"
                : tenant.subscriptionStatus === "active"
                ? "Aktiv"
                : tenant.subscriptionStatus === "paused"
                ? "Pausiert"
                : tenant.subscriptionStatus}
            </span>
          </p>
          <div className="mt-4">
            {tenant.subscriptionStatus === "active" ? (
              <button
                onClick={() => setShowSuspendDialog(true)}
                className="text-red-600 hover:text-red-700 text-sm font-medium"
              >
                Pausieren
              </button>
            ) : tenant.subscriptionStatus === "paused" ? (
              <button
                onClick={() => unsuspendMutation.mutate({ tenantId })}
                className="text-green-600 hover:text-green-700 text-sm font-medium"
              >
                Fortsetzen
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {/* Website & Vorschau */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-900">Website & Vorschau</h3>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">Öffentlich aktiv</span>
            <button
              type="button"
              onClick={() => toggleWebsiteEnabledMutation.mutate({ tenantId, enabled: !tenant.websiteEnabled })}
              disabled={toggleWebsiteEnabledMutation.isPending}
              className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ${
                tenant.websiteEnabled ? "bg-green-500" : "bg-gray-300"
              }`}
              role="switch"
              aria-checked={tenant.websiteEnabled}
            >
              <span
                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ${
                  tenant.websiteEnabled ? "translate-x-4" : "translate-x-0"
                }`}
              />
            </button>
          </div>
        </div>
        <div className="space-y-2">
          <p className="text-xs text-gray-500">Vorschau-URLs</p>
          {tenant.previewToken ? (
            <div className="space-y-1.5">
              {[
                { label: "Website", path: `/${tenant.slug}` },
                { label: "Buchung", path: `/book/${tenant.slug}` },
              ].map(({ label, path }) => (
                <div key={path} className="flex items-center gap-2">
                  <span className="text-xs text-gray-400 w-12 flex-shrink-0">{label}</span>
                  <code className="flex-1 text-xs bg-gray-50 border border-gray-200 rounded px-2 py-1.5 truncate text-blue-600">
                    {`${path}?preview=${tenant.previewToken}`}
                  </code>
                  <button
                      type="button"
                      onClick={() => {
                        void navigator.clipboard.writeText(`https://example.com${path}?preview=${tenant.previewToken}`);
                        setCopiedPreview(true);
                        setTimeout(() => setCopiedPreview(false), 2000);
                      }}
                      className="text-xs text-blue-600 hover:text-blue-700 font-medium whitespace-nowrap"
                    >
                      {copiedPreview ? "✓ Kopiert" : "Kopieren"}
                    </button>
                  </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-gray-400 italic">Kein Token — bitte generieren</p>
          )}
          <button
            type="button"
            onClick={() => generatePreviewTokenMutation.mutate({ tenantId })}
            disabled={generatePreviewTokenMutation.isPending}
            className="text-xs text-blue-600 hover:text-blue-700 font-medium"
          >
            {generatePreviewTokenMutation.isPending ? "Generiert…" : tenant.previewToken ? "Neu generieren" : "Token generieren"}
          </button>
        </div>
      </div>

      {/* Stripe & Abrechnung */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Stripe & Abrechnung</h3>
        {tenant.stripeCustomerId ? (
          <div className="space-y-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <p className="text-xs font-medium text-gray-500">Customer</p>
                <a
                  href={tenant.stripeDashboardUrls?.customerUrl ?? "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 hover:text-blue-700 hover:underline break-all"
                >
                  {tenant.stripeCustomerId}
                  <span className="ml-1 text-xs">↗</span>
                </a>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500">Subscription</p>
                {tenant.stripeSubscriptionId ? (
                  <a
                    href={tenant.stripeDashboardUrls?.subscriptionUrl ?? "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:text-blue-700 hover:underline break-all"
                  >
                    {tenant.stripeSubscriptionId}
                    <span className="ml-1 text-xs">↗</span>
                  </a>
                ) : (
                  <p className="text-sm text-gray-400">Keine Subscription</p>
                )}
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500">Stripe Tarif</p>
                <p className="text-sm text-gray-900">
                  {tenant.currentStripePriceId ?? "—"}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500">Testphase</p>
                <p className="text-sm text-gray-900">
                  {tenant.trialEndsAt
                    ? new Date(tenant.trialEndsAt) > new Date()
                      ? `Endet am ${new Date(tenant.trialEndsAt).toLocaleDateString("de-DE")}`
                      : `Abgelaufen am ${new Date(tenant.trialEndsAt).toLocaleDateString("de-DE")}`
                    : "—"}
                </p>
              </div>
            </div>
            {/* Warnings row */}
            {(tenant.cancelledAtPeriodEnd || tenant.paymentFailureCount > 0 || tenant.deactivatedAt) && (
              <div className="mt-3 pt-3 border-t border-gray-100 space-y-1.5">
                {tenant.cancelledAtPeriodEnd && (
                  <p className="text-xs text-amber-700">
                    Kündigt am {new Date(tenant.cancelledAtPeriodEnd).toLocaleDateString("de-DE")}
                  </p>
                )}
                {tenant.paymentFailureCount > 0 && (
                  <p className="text-xs text-red-700">
                    {tenant.paymentFailureCount} Zahlungsfehlversuche
                    {tenant.paymentGracePeriodEndsAt && new Date(tenant.paymentGracePeriodEndsAt) > new Date()
                      ? ` — Gnadenfrist bis ${new Date(tenant.paymentGracePeriodEndsAt).toLocaleDateString("de-DE")}`
                      : tenant.paymentGracePeriodEndsAt
                      ? " — Gnadenfrist abgelaufen"
                      : ""}
                  </p>
                )}
                {tenant.deactivatedAt && (
                  <p className="text-xs text-red-700">
                    Deaktiviert am {new Date(tenant.deactivatedAt).toLocaleDateString("de-DE")}
                  </p>
                )}
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-gray-400">Noch kein Stripe-Kunde</p>
        )}
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
                setAiReceptionOverride(nextValue);
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

      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h3 className="text-sm font-semibold text-gray-900">Systemrollen</h3>
        <p className="mt-1 text-xs text-gray-500">
          Standardmäßig sind Systemrollen gesperrt. Aktivieren erlaubt Tenant-Admins, die
          Systemrollen-Berechtigungen selbst anzupassen.
        </p>

        <div className="mt-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-gray-900">Tenant darf Systemrollen bearbeiten</p>
            <p className="text-xs text-gray-500">
              Bei Deaktivierung werden Systemrollen auf Plattform-Defaults zurückgeführt.
            </p>
          </div>
          <label className="inline-flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={systemRolesEditable}
              onChange={(e) => {
                const nextValue = e.target.checked;
                setSystemRolesEditableOverride(nextValue);
                setSystemRolesEditableMutation.mutate({
                  tenantId,
                  editable: nextValue,
                });
              }}
              disabled={setSystemRolesEditableMutation.isPending}
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            {setSystemRolesEditableMutation.isPending ? "Speichert..." : "Aktiv"}
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
