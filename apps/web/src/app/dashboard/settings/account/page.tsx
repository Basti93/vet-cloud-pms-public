"use client";

import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc/client";
import { useRouter, useSearchParams } from "next/navigation";
import { PERMISSIONS } from "@/lib/db/schema";
import { Info } from "lucide-react";
import { trackEvent } from "@/lib/analytics/tracker";
import { AnalyticsEvents } from "@/lib/analytics/events";

export default function AccountPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [exportLoading, setExportLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [reactivateLoading, setReactivateLoading] = useState(false);
  const [undoCancelLoading, setUndoCancelLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [deactivationMailSent, setDeactivationMailSent] = useState(false);

  const statusMessage = searchParams.get("status");

  useEffect(() => {
    if (statusMessage === "success") {
      trackEvent(AnalyticsEvents.SUBSCRIPTION_CHECKOUT_RETURNED, { status: "success" });
    } else if (statusMessage === "cancel") {
      trackEvent(AnalyticsEvents.SUBSCRIPTION_CHECKOUT_RETURNED, { status: "cancelled" });
    }
  }, [statusMessage]);

  const { data: currentUser } = trpc.admin.getCurrentUser.useQuery();
  const { data: permissions, isLoading: permissionsLoading } =
    trpc.admin.getUserPermissions.useQuery();
  const { data: tenant } = trpc.tenant.getCurrent.useQuery();
  const { data: deletionStatus } = trpc.tenant.getDeletionStatus.useQuery();
  const { data: subscriptionStatus } = trpc.subscriptions.getSubscriptionStatus.useQuery();
  const utils = trpc.useUtils();
  const requestDeletionMutation = trpc.tenant.requestDeletion.useMutation();
  const createCheckoutMutation = trpc.subscriptions.createCheckoutSession.useMutation();
  const changePlanMutation = trpc.subscriptions.changePlan.useMutation();
  const cancelSubscriptionMutation = trpc.subscriptions.cancelSubscription.useMutation();
  const reactivateSubscriptionMutation = trpc.subscriptions.reactivateSubscription.useMutation();
  const undoCancellationMutation = trpc.subscriptions.undoCancellation.useMutation();
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const [pendingTier, setPendingTier] = useState<"solo" | "praxis" | "klinik" | null>(null);
  const [billingInterval, setBillingInterval] = useState<"monthly" | "annual">("monthly");
  const canManageSettings = Boolean(
    permissions?.includes(PERMISSIONS.SETTINGS_MANAGE)
  );

  const TIER_INFO = {
    solo:   { label: "Solo",   desc: "bis 3 Nutzer", monthly: 59,  annual: 590  },
    praxis: { label: "Praxis", desc: "bis 7 Nutzer", monthly: 119, annual: 1190 },
    klinik: { label: "Klinik", desc: "bis 15 Nutzer", monthly: 199, annual: 1990 },
  } as const;

  const TIER_ORDER = ["solo", "praxis", "klinik"] as const;

  useEffect(() => {
    if (checkoutUrl) {
      window.location.href = checkoutUrl;
    }
  }, [checkoutUrl]);

  const handleSelectTier = (tier: "solo" | "praxis" | "klinik") => {
    if (!subscriptionStatus?.currentTier) {
      handleCheckout(tier);
      return;
    }
    setPendingTier(tier);
    setErrorMessage("");
    setSuccessMessage("");
  };

  const handleCheckout = async (tier: "solo" | "praxis" | "klinik") => {
    try {
      setErrorMessage("");
      trackEvent(AnalyticsEvents.SUBSCRIPTION_CHECKOUT_STARTED, { tier, billingInterval });
      const result = await createCheckoutMutation.mutateAsync({ tier, billingInterval });
      if (result.url) {
        setCheckoutUrl(result.url);
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Fehler beim Starten des Checkouts");
    }
  };

  const handleConfirmPlanChange = async () => {
    if (!pendingTier) return;
    try {
      setErrorMessage("");
      const result = await changePlanMutation.mutateAsync({ tier: pendingTier, billingInterval });
      const currentTierIndex = TIER_ORDER.indexOf(subscriptionStatus?.currentTier?.tier ?? "solo");
      const newTierIndex = TIER_ORDER.indexOf(pendingTier);
      const isUpgrade = newTierIndex > currentTierIndex;
      trackEvent(AnalyticsEvents.SUBSCRIPTION_PLAN_CHANGED, {
        from_tier: subscriptionStatus?.currentTier?.tier ?? "none",
        to_tier: pendingTier,
        billingInterval,
        direction: isUpgrade ? "upgrade" : "downgrade",
      });
      const deactivated = (result as { deactivatedUserCount?: number }).deactivatedUserCount ?? 0;
      if (deactivated > 0) {
        setSuccessMessage(
          `Tarif geändert. ${deactivated} ${deactivated === 1 ? "Benutzer wurde" : "Benutzer wurden"} deaktiviert, da der neue Tarif weniger Plätze hat. Sie können Benutzer unter Team & Benutzer reaktivieren, wenn Plätze frei werden.`
        );
      } else {
        setSuccessMessage(
          isUpgrade
            ? "Tarif erfolgreich aktualisiert. Die anteilige Differenz wird Ihrer nächsten Rechnung hinzugefügt."
            : "Tarif geändert. Der neue Tarif gilt ab dem nächsten Abrechnungszeitraum."
        );
      }
      setPendingTier(null);
      await utils.subscriptions.getSubscriptionStatus.invalidate();
    } catch (error) {
      console.error("Failed to change plan:", error);
      setErrorMessage(error instanceof Error ? error.message : "Fehler beim Ändern des Tarifs");
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
      trackEvent(AnalyticsEvents.SUBSCRIPTION_CANCELLED);
      await utils.subscriptions.getSubscriptionStatus.invalidate();
    } catch (error) {
      console.error("Failed to cancel subscription:", error);
      setErrorMessage(
        error instanceof Error ? error.message : "Fehler beim Kündigen des Abos"
      );
    } finally {
      setCancelLoading(false);
    }
  };

  const handleUndoCancellation = async () => {
    const confirmed = window.confirm(
      "Möchten Sie die Kündigung zurückziehen? Das Abonnement läuft dann weiter."
    );
    if (!confirmed) return;

    try {
      setUndoCancelLoading(true);
      setErrorMessage("");
      await undoCancellationMutation.mutateAsync({});
      setSuccessMessage("Kündigung erfolgreich zurückgezogen. Das Abonnement läuft weiter.");
      trackEvent(AnalyticsEvents.SUBSCRIPTION_CANCEL_UNDONE);
      await utils.subscriptions.getSubscriptionStatus.invalidate();
    } catch (error) {
      console.error("Failed to undo cancellation:", error);
      setErrorMessage(
        error instanceof Error ? error.message : "Fehler beim Zurückziehen der Kündigung"
      );
    } finally {
      setUndoCancelLoading(false);
    }
  };

  const handleReactivateSubscription = async () => {
    try {
      setReactivateLoading(true);
      setErrorMessage("");
      await reactivateSubscriptionMutation.mutateAsync({});
      setSuccessMessage("Abonnement erfolgreich reaktiviert. Die Praxis ist wieder aktiv.");
      trackEvent(AnalyticsEvents.SUBSCRIPTION_REACTIVATED);
      await utils.subscriptions.getSubscriptionStatus.invalidate();
    } catch (error) {
      console.error("Failed to reactivate subscription:", error);
      setErrorMessage(
        error instanceof Error ? error.message : "Fehler beim Reaktivieren des Abos"
      );
    } finally {
      setReactivateLoading(false);
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
      trackEvent(AnalyticsEvents.DATA_EXPORTED);
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
      trackEvent(AnalyticsEvents.ACCOUNT_DELETION_REQUESTED);
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
          {subscriptionStatus.deactivatedAt && (
            <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-900 text-sm">
              <p className="font-semibold">⚠️ Praxis deaktiviert</p>
              <p>
                Die Praxis wurde am {new Date(subscriptionStatus.deactivatedAt).toLocaleDateString("de-DE")} deaktiviert.
                Sie können nur noch auf diese Seite und den Datenexport zugreifen. Alle anderen Funktionen sind blockiert.
              </p>
            </div>
          )}

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
            <div className="p-4 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-sm">
              <p className="font-semibold mb-1">Abonnement wird gekündigt</p>
              <p className="mb-3">
                Das Abonnement endet am{" "}
                {new Date(subscriptionStatus.cancelledAtPeriodEnd).toLocaleDateString("de-DE")}.
                Danach wird die Praxis deaktiviert und ist nur noch im Lesemodus verfügbar.
              </p>
              <button
                onClick={handleUndoCancellation}
                disabled={undoCancelLoading}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-amber-900 border border-amber-400 hover:bg-amber-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {undoCancelLoading ? "Wird zurückgezogen..." : "Kündigung zurückziehen"}
              </button>
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
                {subscriptionStatus.currentTier ? (
                  <p>
                    {subscriptionStatus.isTrialing ? "Gewählter Tarif:" : "Aktueller Tarif:"}{" "}
                    <span className="font-medium capitalize">
                      {TIER_INFO[subscriptionStatus.currentTier.tier as keyof typeof TIER_INFO]?.label ?? subscriptionStatus.currentTier.tier}{" "}
                      ({subscriptionStatus.currentTier.interval === "annual" ? "Jahresabo" : "monatlich"})
                    </span>
                  </p>
                ) : subscriptionStatus.isTrialing ? (
                  <p>Tarif: <span className="font-medium text-amber-600">Noch kein Tarif gewählt</span></p>
                ) : null}
                {subscriptionStatus.trialEndsAt && (
                  <p>
                    Testphase endet: <span className="font-medium">
                      {new Date(subscriptionStatus.trialEndsAt).toLocaleDateString("de-DE")}
                    </span>
                  </p>
                )}
              </div>
              {subscriptionStatus.isTrialing && subscriptionStatus.currentTier && subscriptionStatus.trialEndsAt && (
                <div className="mt-3 p-3 rounded-lg bg-blue-50 border border-blue-200 text-xs text-blue-800 flex gap-2">
                  <Info className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>
                    Nach der Testphase ({new Date(subscriptionStatus.trialEndsAt).toLocaleDateString("de-DE")}) wird automatisch{" "}
                    <strong>
                      €{subscriptionStatus.currentTier.interval === "annual"
                        ? (subscriptionStatus.currentTier.unitAmount / 100).toFixed(0) + "/Jahr"
                        : (subscriptionStatus.currentTier.unitAmount / 100).toFixed(0) + "/Monat"}
                    </strong> berechnet.
                    Sie können den Tarif jederzeit vor Ablauf der Testphase ändern.
                  </span>
                </div>
              )}
            </div>

            {subscriptionStatus.isTrialing && !subscriptionStatus.currentTier && (
              <div className="mb-4 p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-800 flex gap-2 items-start">
                <Info className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  Sie testen Tierarzt Cloud kostenlos. Wählen Sie jetzt einen Tarif — Sie werden erst nach Ablauf der Testphase belastet.
                </span>
              </div>
            )}

            {/* Billing interval toggle */}
            <div className="mb-4 flex items-center gap-3">
              <span className="text-sm text-muted">Abrechnung:</span>
              <div className="flex rounded-lg border border-border overflow-hidden text-sm">
                <button
                  onClick={() => setBillingInterval("monthly")}
                  className={`px-3 py-1.5 transition-colors ${billingInterval === "monthly" ? "bg-accent text-white font-medium" : "bg-surface text-muted hover:bg-muted-soft"}`}
                >
                  Monatlich
                </button>
                <button
                  onClick={() => setBillingInterval("annual")}
                  className={`px-3 py-1.5 transition-colors ${billingInterval === "annual" ? "bg-accent text-white font-medium" : "bg-surface text-muted hover:bg-muted-soft"}`}
                >
                  Jährlich <span className="text-xs opacity-75">(2 Monate gratis)</span>
                </button>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              {(["solo", "praxis", "klinik"] as const).map((tier) => {
                const info = TIER_INFO[tier];
                const price = billingInterval === "annual" ? info.annual : info.monthly;
                const isCurrent = subscriptionStatus.currentTier?.tier === tier;
                const isPending = pendingTier === tier;
                return (
                  <button
                    key={tier}
                    onClick={() => handleSelectTier(tier)}
                    disabled={
                      createCheckoutMutation.isPending ||
                      changePlanMutation.isPending ||
                      !!subscriptionStatus.cancelledAtPeriodEnd ||
                      isCurrent ||
                      isPending
                    }
                    className="p-4 rounded-lg border transition-all text-sm font-medium hover:border-accent disabled:opacity-50 disabled:cursor-not-allowed text-left"
                    style={{ borderColor: isCurrent ? "var(--color-accent)" : undefined, background: isCurrent ? "var(--color-accent-soft, #f0faf0)" : undefined }}
                  >
                    <div className="font-bold text-base">{info.label}</div>
                    <div className="text-xs text-muted font-normal mt-0.5">{info.desc}</div>
                    <div className="mt-2 font-semibold">
                      €{price}<span className="text-xs font-normal text-muted">/{billingInterval === "annual" ? "Jahr" : "Monat"}</span>
                    </div>
                    {isCurrent && (
                      <div className="mt-1 text-xs font-medium" style={{ color: "var(--color-accent)" }}>Aktuell</div>
                    )}
                  </button>
                );
              })}
            </div>

            {pendingTier && subscriptionStatus.currentTier && (() => {
              const currentIdx = TIER_ORDER.indexOf(subscriptionStatus.currentTier!.tier as "solo" | "praxis" | "klinik");
              const newIdx = TIER_ORDER.indexOf(pendingTier);
              const isUpgrade = newIdx > currentIdx;
              const pending = TIER_INFO[pendingTier];
              const current = TIER_INFO[subscriptionStatus.currentTier!.tier as keyof typeof TIER_INFO];
              const pendingPrice = billingInterval === "annual" ? pending.annual : pending.monthly;
              return (
                <div className="mt-4 p-4 rounded-lg border border-blue-200 bg-blue-50 text-sm">
                  <p className="font-semibold text-blue-900 mb-1">
                    {subscriptionStatus.isTrialing
                      ? "Tarif ändern"
                      : isUpgrade ? "Upgrade bestätigen" : "Downgrade bestätigen"}
                  </p>
                  <p className="text-blue-800 mb-1">
                    {current?.label} → {pending.label} (€{pendingPrice}/{billingInterval === "annual" ? "Jahr" : "Monat"})
                  </p>
                  <p className="text-blue-700 text-xs mb-3">
                    {subscriptionStatus.isTrialing
                      ? "Während der Testphase entstehen keine Kosten. Der neue Tarif wird nach Ablauf der Testphase berechnet."
                      : isUpgrade
                      ? "Die anteilige Differenz für den verbleibenden Abrechnungszeitraum wird Ihrer nächsten Rechnung hinzugefügt."
                      : `Der neue Tarif gilt ab dem nächsten Abrechnungszeitraum. Für den aktuellen Zeitraum erhalten Sie keine Rückerstattung.${
                          (subscriptionStatus.maxUsers ?? 3) > (TIER_INFO[pendingTier].desc.match(/\d+/)?.[0] ? parseInt(TIER_INFO[pendingTier].desc) : 3)
                            ? ` Achtung: Überschüssige nicht-Admin-Benutzer werden automatisch deaktiviert.`
                            : ""
                        }`}
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={handleConfirmPlanChange}
                      disabled={changePlanMutation.isPending}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                      {changePlanMutation.isPending ? "Wird geändert..." : "Bestätigen"}
                    </button>
                    <button
                      onClick={() => setPendingTier(null)}
                      disabled={changePlanMutation.isPending}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium text-blue-800 border border-blue-300 hover:bg-blue-100 disabled:opacity-50 transition-all"
                    >
                      Abbrechen
                    </button>
                  </div>
                </div>
              );
            })()}

            {subscriptionStatus.deactivatedAt && (
              <div className="mt-6 pt-6 border-t border-border">
                <button
                  onClick={handleReactivateSubscription}
                  disabled={reactivateLoading}
                  className="px-4 py-2 rounded-lg font-medium text-green-600 border border-green-300 hover:bg-green-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {reactivateLoading ? "Wird reaktiviert..." : "Abonnement reaktivieren"}
                </button>
              </div>
            )}

            {(subscriptionStatus.status === "active" || subscriptionStatus.status === "trial") && !subscriptionStatus.cancelledAtPeriodEnd && !subscriptionStatus.deactivatedAt && subscriptionStatus.currentTier && (
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
                Laden Sie eine Kopie aller Ihrer Daten herunter. Dies umfasst alle Praxisinformationen, Tierdaten, Termine und andere personenbezogene Daten.
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
                    <li>Alle Tierdaten werden dauerhaft gelöscht</li>
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


    </div>
  );
}
