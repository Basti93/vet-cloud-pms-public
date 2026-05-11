"use client";

import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc/client";
import { useRouter, useSearchParams } from "next/navigation";
import { PERMISSIONS } from "@/lib/db/schema";

export default function AccountPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [exportLoading, setExportLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [deactivationMailSent, setDeactivationMailSent] = useState(false);

  const statusMessage = searchParams.get("status");

  const { data: currentUser } = trpc.admin.getCurrentUser.useQuery();
  const { data: permissions, isLoading: permissionsLoading } =
    trpc.admin.getUserPermissions.useQuery();
  const { data: tenant } = trpc.tenant.getCurrent.useQuery();
  const { data: deletionStatus } = trpc.tenant.getDeletionStatus.useQuery();
  const { data: subscriptionStatus } = trpc.subscriptions.getSubscriptionStatus.useQuery();
  const requestDeletionMutation = trpc.tenant.requestDeletion.useMutation();
  const createCheckoutMutation = trpc.subscriptions.createCheckoutSession.useMutation();
  const cancelSubscriptionMutation = trpc.subscriptions.cancelSubscription.useMutation();
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const canManageSettings = Boolean(
    permissions?.includes(PERMISSIONS.SETTINGS_MANAGE)
  );

  useEffect(() => {
    if (checkoutUrl) {
      window.location.href = checkoutUrl;
    }
  }, [checkoutUrl]);

  const handleUpgrade = async (seats: number) => {
    try {
      const result = await createCheckoutMutation.mutateAsync({ seats });
      if (result.url) {
        setCheckoutUrl(result.url);
      }
    } catch (error) {
      console.error("Failed to create checkout session:", error);
    }
  };

  const handleCancelSubscription = async () => {
    const confirmed = window.confirm(
      "Möchten Sie Ihr Abonnement wirklich kündigen? Die Praxis wird zum Ende des aktuellen Abrechnungszyklus deaktiviert."
    );
    if (!confirmed) return;

    try {
      setCancelLoading(true);
      setErrorMessage("");
      await cancelSubscriptionMutation.mutateAsync({});
      setSuccessMessage("Abonnement erfolgreich gekündigt. Die Praxis wird zum Ende des Abrechnungszyklus deaktiviert.");
      // Refresh subscription status
      await new Promise((resolve) => setTimeout(resolve, 1000));
      router.refresh();
    } catch (error) {
      console.error("Failed to cancel subscription:", error);
      setErrorMessage(
        error instanceof Error ? error.message : "Fehler beim Kündigen des Abos"
      );
    } finally {
      setCancelLoading(false);
    }
  };

  const handleExportData = async () => {
    try {
      setExportLoading(true);
      setErrorMessage("");
      const response = await fetch("/api/user/export");

      if (!response.ok) {
        throw new Error("Fehler beim Exportieren der Daten");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `example-export-${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setSuccessMessage("Daten erfolgreich exportiert und heruntergeladen");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Fehler beim Exportieren der Daten"
      );
    } finally {
      setExportLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!tenant?.id) {
      setErrorMessage("Praxisdaten nicht geladen. Bitte aktualisieren Sie die Seite.");
      return;
    }
    if (!currentUser?.id || !currentUser?.email) {
      setErrorMessage("Benutzerdaten nicht geladen. Bitte aktualisieren Sie die Seite.");
      return;
    }

    try {
      setDeleteLoading(true);
      setErrorMessage("");
      const confirmed = window.confirm(
        "Praxis jetzt deaktivieren und Löschung in 30 Tagen planen? Diese Aktion sperrt den Zugriff sofort."
      );
      if (!confirmed) {
        setDeleteLoading(false);
        return;
      }
      console.log("Requesting deletion for tenant:", tenant.id, "user:", currentUser.id);

      const result = await requestDeletionMutation.mutateAsync({
        tenantId: tenant.id,
        userId: currentUser.id,
      });

      if (result.emailSent) {
        setDeactivationMailSent(true);
        setSuccessMessage(
          "Eine Deaktivierungs-Email wurde an " +
            currentUser.email +
            " gesendet. Die Praxis ist pausiert und wird in 30 Tagen gelöscht, sofern sie nicht über den Reaktivierungslink wieder aktiviert wird."
        );
      } else {
        setSuccessMessage(
          "Die Praxis wurde pausiert und die Löschung in 30 Tagen geplant. Die Benachrichtigungs-Email konnte nicht gesendet werden."
        );
      }

      // Force transition into the server-rendered deactivated dashboard shell.
      router.replace("/dashboard");
      router.refresh();
    } catch (error) {
      console.error("Delete error:", error);
      setErrorMessage(
        error instanceof Error ? error.message : "Fehler beim Löschen des Kontos"
      );
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Checkout Status Messages */}
      {statusMessage === "success" && (
        <div className="p-4 rounded-lg bg-green-50 border border-green-200 text-green-800 text-sm">
          ✓ Danke! Ihr Abo wurde aktiviert.
        </div>
      )}
      {statusMessage === "cancel" && (
        <div className="p-4 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm">
          Checkout abgebrochen. Sie können jederzeit upgraden.
        </div>
      )}

      {/* Subscription Status Section */}
      {subscriptionStatus && (
        <>
          {subscriptionStatus.trialDaysUsed > 0 && subscriptionStatus.originalTrialEndsAt && (
            <div className="p-4 rounded-lg bg-blue-50 border border-blue-200 text-blue-900 text-sm">
              <p className="font-semibold">✓ Testphase erhalten</p>
              <p>
                Sie haben Ihr Abo während der Testphase aktualisiert. Die ursprünglichen {subscriptionStatus.trialDaysUsed} Tage wurden berücksichtigt.
                Testphase endet am {new Date(subscriptionStatus.originalTrialEndsAt).toLocaleDateString("de-DE")}.
              </p>
            </div>
          )}

          {subscriptionStatus.isTrialing && subscriptionStatus.daysUntilTrialEnds && subscriptionStatus.daysUntilTrialEnds <= 7 && (
            <div className={`p-4 rounded-lg border text-sm ${
              subscriptionStatus.daysUntilTrialEnds <= 0
                ? "bg-red-50 border-red-200 text-red-900"
                : "bg-orange-50 border-orange-200 text-orange-900"
            }`}>
              <p className="font-semibold">
                {subscriptionStatus.daysUntilTrialEnds <= 0
                  ? "Testphase beendet"
                  : `Testphase endet in ${subscriptionStatus.daysUntilTrialEnds} Tagen`}
              </p>
              {subscriptionStatus.daysUntilTrialEnds > 0 && (
                <p>
                  Nach dieser Zeit wird die Klinik deaktiviert. Aktivieren Sie jetzt ein Abo.
                </p>
              )}
            </div>
          )}

          {subscriptionStatus.paymentGracePeriodEndsAt &&
           new Date(subscriptionStatus.paymentGracePeriodEndsAt) > new Date() && (
            <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-900 text-sm">
              <p className="font-semibold">⚠️ Zahlung fehlgeschlagen</p>
              <p>
                Zahlungsmethode konnte nicht eingezogen werden. Bitte aktualisieren Sie Ihre Zahlungsmethode bis{" "}
                {new Date(subscriptionStatus.paymentGracePeriodEndsAt).toLocaleDateString("de-DE")}.
                Danach wird die Praxis deaktiviert.
              </p>
            </div>
          )}

          {subscriptionStatus.cancelledAtPeriodEnd && (
            <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-900 text-sm">
              <p className="font-semibold">Abonnement wird gekündigt</p>
              <p>
                Das Abonnement endet am{" "}
                {new Date(subscriptionStatus.cancelledAtPeriodEnd).toLocaleDateString("de-DE")}.
                Danach wird die Praxis deaktiviert und ist nur noch im Lesemodus verfügbar.
              </p>
            </div>
          )}

          <div className="bg-surface rounded-2xl border border-border shadow-sm p-6">
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-fg mb-2">Abonnement</h2>
              <div className="text-sm text-muted space-y-1">
                <p>
                  Status: <span className="font-medium capitalize">
                    {subscriptionStatus.status === "trial" ? "Testphase" : subscriptionStatus.status}
                  </span>
                </p>
                {subscriptionStatus.currentPrice && (
                  <p>
                    Aktueller Tarif: <span className="font-medium">
                      {subscriptionStatus.currentPrice.seats} Nutzer (
                      €{(subscriptionStatus.currentPrice.monthlyPrice / 100).toFixed(2)}/Monat)
                    </span>
                  </p>
                )}
                {subscriptionStatus.trialEndsAt && (
                  <p>
                    Testphase endet: <span className="font-medium">
                      {new Date(subscriptionStatus.trialEndsAt).toLocaleDateString("de-DE")}
                    </span>
                  </p>
                )}
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
              {[
                { seats: 1, price: "€30", desc: "1 Nutzer" },
                { seats: 3, price: "€50", desc: "3 Nutzer" },
                { seats: 5, price: "€100", desc: "5 Nutzer" },
                { seats: 10, price: "€200", desc: "10 Nutzer" },
              ].map((tier) => (
                <button
                  key={tier.seats}
                  onClick={() => handleUpgrade(tier.seats)}
                  disabled={createCheckoutMutation.isPending || !!subscriptionStatus.cancelledAtPeriodEnd}
                  className="p-4 rounded-lg border border-gray-200 transition-all text-sm font-medium hover:border-blue-300 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div>{tier.price}</div>
                  <div className="text-xs text-gray-600 font-normal">{tier.desc}</div>
                </button>
              ))}
            </div>

            {(subscriptionStatus.status === "active" || subscriptionStatus.status === "trial") && !subscriptionStatus.cancelledAtPeriodEnd && (
              <div className="mt-6 pt-6 border-t border-border">
                <button
                  onClick={handleCancelSubscription}
                  disabled={cancelLoading}
                  className="px-4 py-2 rounded-lg font-medium text-red-600 border border-red-300 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {cancelLoading ? "Wird gekündigt..." : "Abo kündigen"}
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {deletionStatus?.isDeactivationScheduled && deletionStatus.scheduledFor && (
        <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-900 text-sm">
          <p className="font-semibold">Praxis ist deaktiviert</p>
          <p>
            Löschung geplant für{" "}
            {new Date(deletionStatus.scheduledFor).toLocaleDateString("de-DE")}.{" "}
            Reaktivierung ist über den E-Mail-Link oder System-Admin möglich.
          </p>
        </div>
      )}

      {/* Error Messages */}
      {errorMessage && (
        <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm">
          {errorMessage}
        </div>
      )}

      {/* Success Messages */}
      {successMessage && (
        <div className="p-4 rounded-lg bg-green-50 border border-green-200 text-green-800 text-sm">
          {successMessage}
        </div>
      )}

      {canManageSettings ? (
        <>
          {/* Data Export Section */}
          <div className="bg-surface rounded-2xl border border-border shadow-sm p-6">
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-fg mb-2">Datenexport (DSGVO Art. 20)</h2>
              <p className="text-sm text-muted">
                Laden Sie eine Kopie aller Ihrer Daten herunter. Dies umfasst alle Praxisinformationen, Patientendaten, Termine und andere personenbezogene Daten.
              </p>
            </div>

            <button
              onClick={handleExportData}
              disabled={exportLoading}
              className="px-6 py-3 rounded-lg font-medium transition-all text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {exportLoading ? "Wird exportiert..." : "Daten exportieren"}
            </button>

            <p className="text-xs text-muted mt-4">
              Die Daten werden als JSON-Datei heruntergeladen und können in anderen Systemen importiert werden.
            </p>
          </div>

          {/* Account Deletion Section */}
          <div className="bg-surface rounded-2xl border border-red-200 shadow-sm p-6">
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-red-600 mb-2">
                Konto löschen (DSGVO Art. 17)
              </h2>
              <p className="text-sm text-muted">
                Dieses Konto und alle zugehörigen Daten werden permanent gelöscht. Diese Aktion kann nicht rückgängig gemacht werden.
              </p>
            </div>

            {!deactivationMailSent ? (
              <>
                <div className="p-4 rounded-lg bg-red-50 border border-red-200 mb-4">
                  <p className="text-sm text-red-900 font-semibold mb-3">
                    ⚠️ Vor dem Löschen:
                  </p>
                  <ul className="text-sm text-red-800 list-disc list-inside space-y-1">
                    <li>Stellen Sie sicher, dass Sie keine ausstehenden Verträge haben</li>
                    <li>Alle Patientendaten werden dauerhaft gelöscht</li>
                    <li>Diese Aktion kann nicht rückgängig gemacht werden</li>
                    <li>Sie erhalten eine E-Mail mit Reaktivierungslink</li>
                  </ul>
                </div>

                <button
                  onClick={handleDeleteAccount}
                  disabled={
                    deleteLoading ||
                    !tenant ||
                    !currentUser ||
                    Boolean(deletionStatus?.isDeactivationScheduled)
                  }
                  className="px-6 py-3 rounded-lg font-medium transition-all text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  title={!tenant || !currentUser ? "Daten werden geladen..." : ""}
                >
                  {deleteLoading
                    ? "Wird vorbereitet..."
                    : deletionStatus?.isDeactivationScheduled
                    ? "Bereits deaktiviert"
                    : "Konto deaktivieren"}
                </button>

                <p className="text-xs text-muted mt-4">
                  Die Praxis wird sofort pausiert. In der E-Mail ist ein Reaktivierungslink enthalten.
                </p>
              </>
            ) : (
              <div className="p-4 rounded-lg bg-green-50 border border-green-200">
                <p className="text-sm text-green-900 font-semibold mb-2">
                  ✓ Deaktivierungs-Email gesendet
                </p>
                <p className="text-sm text-green-800">
                  Eine Email mit Reaktivierungslink wurde an <strong>{currentUser?.email}</strong> gesendet.
                  Ohne Reaktivierung wird die Praxis nach 30 Tagen endgültig gelöscht.
                </p>
              </div>
            )}
          </div>
        </>
      ) : !permissionsLoading ? (
        <div className="bg-surface rounded-2xl border border-border shadow-sm p-6">
          <h2 className="text-lg font-semibold text-fg mb-2">Administrator erforderlich</h2>
          <p className="text-sm text-muted">
            Datenexport und Kontolöschung sind nur für Praxis-Administratoren verfügbar.
            Bitte wenden Sie sich an einen Admin Ihrer Praxis.
          </p>
        </div>
      ) : null}

      {/* DSGVO Rights Information */}
      <div className="bg-surface rounded-2xl border border-border shadow-sm p-6">
        <h3 className="text-lg font-semibold text-fg mb-4">Ihre DSGVO-Rechte</h3>
        <ul className="space-y-2 text-sm text-muted">
          <li>
            <strong>Recht auf Auskunft (Art. 15):</strong> Sie können eine Kopie aller Ihre Daten betreffenden Informationen anfordern.
          </li>
          <li>
            <strong>Recht auf Berichtigung (Art. 16):</strong> Sie können Ihre Daten korrigieren, indem Sie die Einstellungen ändern.
          </li>
          <li>
            <strong>Recht auf Löschung (Art. 17):</strong> Sie können die Löschung Ihres Kontos anfordern (siehe oben).
          </li>
          <li>
            <strong>Recht auf Datenübertragbarkeit (Art. 20):</strong> Sie können Ihre Daten in einem strukturierten Format herunterladen (siehe oben).
          </li>
          <li>
            <strong>Fragen zum Datenschutz?</strong> Kontaktieren Sie uns unter{" "}
            <a href="mailto:user@example.com" className="text-blue-600 hover:underline">
              user@example.com
            </a>
          </li>
        </ul>
      </div>
    </div>
  );
}
