"use client";

import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc/client";
import { useSearchParams } from "next/navigation";
import { PERMISSIONS } from "@/lib/db/schema";
import { Info } from "lucide-react";
import { trackEvent } from "@/lib/analytics/tracker";
import { AnalyticsEvents } from "@/lib/analytics/events";

const TIER_INFO = {
  solo:   { label: "Solo",   desc: "bis 3 Nutzer",  monthly: 59,  annual: 590  },
  praxis: { label: "Praxis", desc: "bis 7 Nutzer",  monthly: 119, annual: 1190 },
  klinik: { label: "Klinik", desc: "bis 15 Nutzer", monthly: 199, annual: 1990 },
} as const;

const TIER_ORDER = ["solo", "praxis", "klinik"] as const;

export default function SubscriptionPage() {
  const searchParams = useSearchParams();
  const [cancelLoading, setCancelLoading] = useState(false);
  const [reactivateLoading, setReactivateLoading] = useState(false);
  const [undoCancelLoading, setUndoCancelLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [pendingTier, setPendingTier] = useState<"solo" | "praxis" | "klinik" | null>(null);
  const [billingInterval, setBillingInterval] = useState<"monthly" | "annual">("monthly");
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);

  const statusMessage = searchParams.get("status");

  const { data: permissions } = trpc.admin.getUserPermissions.useQuery();
  const { data: subscriptionStatus } = trpc.subscriptions.getSubscriptionStatus.useQuery();
  const utils = trpc.useUtils();

  const createCheckoutMutation = trpc.subscriptions.createCheckoutSession.useMutation();
  const changePlanMutation = trpc.subscriptions.changePlan.useMutation();
  const cancelSubscriptionMutation = trpc.subscriptions.cancelSubscription.useMutation();
  const reactivateSubscriptionMutation = trpc.subscriptions.reactivateSubscription.useMutation();
  const undoCancellationMutation = trpc.subscriptions.undoCancellation.useMutation();

  const canManageSettings = Boolean(permissions?.includes(PERMISSIONS.SETTINGS_MANAGE));

  useEffect(() => {
    if (statusMessage === "success") {
      trackEvent(AnalyticsEvents.SUBSCRIPTION_CHECKOUT_RETURNED, { status: "success" });
    } else if (statusMessage === "cancel") {
      trackEvent(AnalyticsEvents.SUBSCRIPTION_CHECKOUT_RETURNED, { status: "cancelled" });
    }
  }, [statusMessage]);

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
      setErrorMessage(error instanceof Error ? error.message : "Fehler beim Kündigen des Abos");
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
      setErrorMessage(error instanceof Error ? error.message : "Fehler beim Zurückziehen der Kündigung");
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
      setErrorMessage(error instanceof Error ? error.message : "Fehler beim Reaktivieren des Abos");
    } finally {
      setReactivateLoading(false);
    }
  };

  if (!canManageSettings) {
    return (
      <div className="bg-surface rounded-2xl border border-border shadow-sm p-6">
        <h2 className="text-lg font-semibold text-fg mb-2">Administrator erforderlich</h2>
        <p className="text-sm text-muted">
          Abonnement-Verwaltung ist nur für Praxis-Administratoren verfügbar.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
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

      {subscriptionStatus && (
        <>
          {/* Status Banners */}
          {subscriptionStatus.deactivatedAt && (
            <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-900 text-sm">
              <p className="font-semibold">⚠️ Praxis deaktiviert</p>
              <p>
                Die Praxis wurde am {new Date(subscriptionStatus.deactivatedAt).toLocaleDateString("de-DE")} deaktiviert.
                Sie können nur noch auf diese Seite und den Datenexport zugreifen.
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
                <p>Nach dieser Zeit wird die Klinik deaktiviert. Aktivieren Sie jetzt ein Abo.</p>
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
                Danach wird die Praxis deaktiviert.
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

          {/* Main Subscription Card */}
          <div className="bg-surface rounded-2xl border border-border shadow-sm p-6">
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-fg mb-2">Abonnement</h2>
              <div className="text-sm text-muted space-y-1">
                <p>
                  Status:{" "}
                  <span className="font-medium capitalize">
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
                    Testphase endet:{" "}
                    <span className="font-medium">
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
                    </strong>{" "}
                    berechnet. Sie können den Tarif jederzeit vor Ablauf der Testphase ändern.
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
              <div
                className="flex rounded-lg border overflow-hidden text-sm"
                style={{ borderColor: "var(--color-border)" }}
              >
                <button
                  onClick={() => setBillingInterval("monthly")}
                  className="px-3 py-1.5 transition-colors"
                  style={
                    billingInterval === "monthly"
                      ? { backgroundColor: "var(--color-accent)", color: "#fff", fontWeight: 500 }
                      : { backgroundColor: "var(--color-surface)", color: "var(--color-muted)" }
                  }
                >
                  Monatlich
                </button>
                <button
                  onClick={() => setBillingInterval("annual")}
                  className="px-3 py-1.5 transition-colors"
                  style={
                    billingInterval === "annual"
                      ? { backgroundColor: "var(--color-accent)", color: "#fff", fontWeight: 500 }
                      : { backgroundColor: "var(--color-surface)", color: "var(--color-muted)" }
                  }
                >
                  Jährlich{" "}
                  <span className="text-xs opacity-75">(2 Monate gratis)</span>
                </button>
              </div>
            </div>

            {/* Tier cards */}
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
                    className="p-4 rounded-lg border transition-all text-sm font-medium hover:border-primary disabled:opacity-50 disabled:cursor-not-allowed text-left"
                    style={{
                      borderColor: isCurrent ? "var(--color-accent)" : undefined,
                      background: isCurrent ? "var(--color-accent-soft, #f0faf0)" : undefined,
                    }}
                  >
                    <div className="font-bold text-base">{info.label}</div>
                    <div className="text-xs text-muted font-normal mt-0.5">{info.desc}</div>
                    <div className="mt-2 font-semibold">
                      €{price}
                      <span className="text-xs font-normal text-muted">
                        /{billingInterval === "annual" ? "Jahr" : "Monat"}
                      </span>
                    </div>
                    {isCurrent && (
                      <div className="mt-1 text-xs font-medium" style={{ color: "var(--color-accent)" }}>
                        Aktuell
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Plan change confirmation */}
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

            {/* Reactivate */}
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

            {/* Cancel */}
            {(subscriptionStatus.status === "active" || subscriptionStatus.status === "trial") &&
              !subscriptionStatus.cancelledAtPeriodEnd &&
              !subscriptionStatus.deactivatedAt &&
              subscriptionStatus.currentTier && (
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

      {/* Error / Success */}
      {errorMessage && (
        <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm">
          {errorMessage}
        </div>
      )}
      {successMessage && (
        <div className="p-4 rounded-lg bg-green-50 border border-green-200 text-green-800 text-sm">
          {successMessage}
        </div>
      )}
    </div>
  );
}
