"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";

export default function AccountPage() {
  const [exportLoading, setExportLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [deletionEmailSent, setDeletionEmailSent] = useState(false);

  const { data: currentUser } = trpc.admin.getCurrentUser.useQuery();
  const { data: tenant } = trpc.tenant.getCurrent.useQuery();
  const requestDeletionMutation = trpc.tenant.requestDeletion.useMutation();

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
      console.log("Requesting deletion for tenant:", tenant.id, "user:", currentUser.id);

      await requestDeletionMutation.mutateAsync({
        tenantId: tenant.id,
        userId: currentUser.id,
      });

      setDeletionEmailSent(true);
      setSuccessMessage(
        "Eine Bestätigungsemail wurde an " +
          currentUser.email +
          " gesendet. Bitte folgen Sie dem Link in der Email, um die Löschung zu bestätigen."
      );
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

        {!deletionEmailSent ? (
          <>
            <div className="p-4 rounded-lg bg-red-50 border border-red-200 mb-4">
              <p className="text-sm text-red-900 font-semibold mb-3">
                ⚠️ Vor dem Löschen:
              </p>
              <ul className="text-sm text-red-800 list-disc list-inside space-y-1">
                <li>Stellen Sie sicher, dass Sie keine ausstehenden Verträge haben</li>
                <li>Alle Patientendaten werden dauerhaft gelöscht</li>
                <li>Diese Aktion kann nicht rückgängig gemacht werden</li>
                <li>Sie erhalten eine Bestätigungsemail mit einem Link</li>
              </ul>
            </div>

            <button
              onClick={handleDeleteAccount}
              disabled={deleteLoading || !tenant || !currentUser}
              className="px-6 py-3 rounded-lg font-medium transition-all text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              title={!tenant || !currentUser ? "Daten werden geladen..." : ""}
            >
              {deleteLoading ? "Wird vorbereitet..." : "Konto löschen"}
            </button>

            <p className="text-xs text-muted mt-4">
              Ein Bestätigungslink wird an Ihre E-Mail-Adresse gesendet. Der Link ist 24 Stunden gültig.
            </p>
          </>
        ) : (
          <div className="p-4 rounded-lg bg-green-50 border border-green-200">
            <p className="text-sm text-green-900 font-semibold mb-2">
              ✓ Bestätigungsemail gesendet
            </p>
            <p className="text-sm text-green-800">
              Eine Email mit einem Bestätigungslink wurde an <strong>{currentUser?.email}</strong> gesendet.
              Bitte folgen Sie dem Link, um die Löschung zu bestätigen. Der Link ist 24 Stunden lang gültig.
            </p>
          </div>
        )}
      </div>

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
