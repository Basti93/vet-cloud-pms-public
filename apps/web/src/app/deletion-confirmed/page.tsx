"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function DeletionConfirmedContent() {
  const searchParams = useSearchParams();
  const success = searchParams.get("success") === "true";
  const message = searchParams.get("message") || "Anfrage verarbeitet";

  return (
    <div className="min-h-screen bg-white text-gray-900 flex items-center justify-center px-4">
      <div className="max-w-md w-full space-y-8">
        {success ? (
          <div className="text-center space-y-4">
            <div className="flex justify-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                <span className="text-3xl">✓</span>
              </div>
            </div>
            <h1 className="text-2xl font-bold text-green-600">Gelöscht</h1>
            <p className="text-gray-600">{message}</p>
            <p className="text-sm text-gray-500 pt-4">
              Ihr Konto und alle damit verbundenen Daten wurden permanent gelöscht. Sie erhalten möglicherweise noch bis zu 90 Tage alte Backup-Daten in unserem System.
            </p>
          </div>
        ) : (
          <div className="text-center space-y-4">
            <div className="flex justify-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
                <span className="text-3xl">✕</span>
              </div>
            </div>
            <h1 className="text-2xl font-bold text-red-600">Fehler</h1>
            <p className="text-gray-600">{message}</p>
            <p className="text-sm text-gray-500 pt-4">
              Der Bestätigungslink ist möglicherweise abgelaufen oder ungültig. Bitte versuchen Sie erneut, Ihr Konto zu löschen.
            </p>
          </div>
        )}

        <div className="pt-8 border-t border-gray-200">
          <Link
            href="/"
            className="w-full text-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            Zur Startseite
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function DeletionConfirmedPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-white flex items-center justify-center">Lädt...</div>}>
      <DeletionConfirmedContent />
    </Suspense>
  );
}
