"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AlertCircle, Copy, Check, Trash2, Info } from "lucide-react";
import { useAuth } from "@clerk/nextjs";

const formatDateTime = (date: Date | string) => {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("de-DE", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export default function CalendarSyncPage() {
  const [copiedTokenId, setCopiedTokenId] = useState<string | null>(null);
  const [showInstructions, setShowInstructions] = useState(true);

  const { data: tokens, isLoading, error } = trpc.calendar.listTokens.useQuery();
  const generateTokenMutation = trpc.calendar.generateToken.useMutation({
    onSuccess: () => {
      refetchTokens();
    },
  });
  const revokeTokenMutation = trpc.calendar.revokeToken.useMutation({
    onSuccess: () => {
      refetchTokens();
    },
  });
  const { refetch: refetchTokens } = trpc.calendar.listTokens.useQuery();

  const handleGenerateToken = () => {
    generateTokenMutation.mutate({
      description: "Kalender Feed",
    });
  };

  const handleCopyUrl = (token: string) => {
    const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
    const iCalUrl = `${baseUrl}/api/calendar/[tenantSlug]/[vetId].ics?token=${token}`;
    navigator.clipboard.writeText(iCalUrl);
    setCopiedTokenId(token);
    setTimeout(() => setCopiedTokenId(null), 2000);
  };

  const handleRevoke = (tokenId: string) => {
    if (confirm("Möchten Sie diesen Token wirklich widerrufen?")) {
      revokeTokenMutation.mutate({ tokenId });
    }
  };

  // Check if user doesn't have permission (non-vet)
  if (error?.message?.includes("veterinarian")) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Kalender Export & Sync</h1>
          <p className="text-gray-600 mt-2">
            Diese Funktion ist nur für Tierärzte verfügbar.
          </p>
        </div>

        <Card className="border-blue-200 bg-blue-50 p-6">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-blue-900 mb-1">Nur für Tierärzte</h3>
              <p className="text-sm text-blue-800">
                Kalender-Export ist eine persönliche Funktion für Tierärzte zur Synchronisierung ihrer Termine mit externen Kalender-Apps. Ihre Rolle erlaubt keinen Zugriff auf diese Funktion.
              </p>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Kalender Export & Sync</h1>
        <p className="text-gray-600 mt-2">
          Synchronisieren Sie Ihre Termine mit Google Calendar, Outlook, Apple Calendar und anderen Kalender-Apps.
        </p>
      </div>

      {/* Instructions */}
      {showInstructions && (
        <Card className="border-blue-200 bg-blue-50 p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-semibold text-blue-900 mb-2">Wie funktioniert es?</h3>
              <ul className="text-sm text-blue-800 space-y-1 mb-3">
                <li>• Generieren Sie einen einmaligen Kalender-Link für Ihre Termine</li>
                <li>• Kopieren Sie den Link und fügen ihn in Ihrer bevorzugten Kalender-App ein</li>
                <li>• Ihre Termine werden automatisch alle 15 Minuten aktualisiert</li>
                <li>• Der Feed ist schreibgeschützt – Änderungen außerhalb dieser App werden nicht übernommen</li>
              </ul>
              <button
                onClick={() => setShowInstructions(false)}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                Ausblenden
              </button>
            </div>
          </div>
        </Card>
      )}

      {/* Generate Token Button */}
      <div>
        <Button
          onClick={handleGenerateToken}
          disabled={generateTokenMutation.isPending}
          className="bg-blue-600 hover:bg-blue-700"
        >
          {generateTokenMutation.isPending ? "Wird generiert..." : "Neuen Kalender-Link generieren"}
        </Button>
      </div>

      {/* Tokens List */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Aktive Kalender-Feeds</h2>

        {isLoading ? (
          <p className="text-gray-500">Wird geladen...</p>
        ) : !tokens || tokens.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-gray-500">
              Noch keine Kalender-Feeds erstellt. Klicken Sie oben auf "Neuen Kalender-Link generieren", um zu beginnen.
            </p>
          </Card>
        ) : (
          <div className="space-y-4">
            {tokens.map((token) => (
              <Card key={token.id} className="p-6 border border-gray-200">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="font-semibold text-gray-900">{token.description}</h3>
                    <p className="text-sm text-gray-500 mt-1">
                      Erstellt: {formatDateTime(token.createdAt)}
                    </p>
                    {token.lastUsedAt && (
                      <p className="text-sm text-gray-500">
                        Zuletzt verwendet: {formatDateTime(token.lastUsedAt)}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleCopyUrl(token.token)}
                      className="gap-2"
                    >
                      {copiedTokenId === token.token ? (
                        <>
                          <Check className="w-4 h-4" />
                          Kopiert
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4" />
                          Kopieren
                        </>
                      )}
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleRevoke(token.id)}
                      disabled={revokeTokenMutation.isPending}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {/* Calendar App Instructions */}
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <h4 className="font-medium text-gray-900 mb-3">Hinzufügen zu Ihrer Kalender-App:</h4>
                  <div className="grid gap-4 md:grid-cols-3">
                    <CalendarAppInstruction
                      app="Google Calendar"
                      steps={[
                        "Gehen Sie zu Google Calendar",
                        "Klicken Sie auf das '+' neben 'Weitere Kalender'",
                        "Wählen Sie 'Per URL abonnieren'",
                        "Fügen Sie den kopierten Link ein",
                      ]}
                    />
                    <CalendarAppInstruction
                      app="Microsoft Outlook"
                      steps={[
                        "Öffnen Sie Outlook",
                        "Klicken Sie auf 'Kalender hinzufügen'",
                        "Wählen Sie 'Von Internet abonnieren'",
                        "Fügen Sie den kopierten Link ein",
                      ]}
                    />
                    <CalendarAppInstruction
                      app="Apple Calendar"
                      steps={[
                        "Öffnen Sie den Finder",
                        "Drücken Sie Cmd+K",
                        "Fügen Sie den kopierten Link ein",
                        "Der Kalender wird hinzugefügt",
                      ]}
                    />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Security Notice */}
      <Card className="border-amber-200 bg-amber-50 p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-amber-900 mb-1">Sicherheit</h3>
            <p className="text-sm text-amber-800">
              Die Kalender-Links sind privat und können nicht geraten werden. Wenn Sie vermuten, dass ein Link kompromittiert wurde, können Sie ihn oben widerrufen und einen neuen erstellen.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}

function CalendarAppInstruction({
  app,
  steps,
}: {
  app: string;
  steps: string[];
}) {
  return (
    <div className="bg-gray-50 rounded-lg p-4">
      <h5 className="font-semibold text-gray-900 mb-2 text-sm">{app}</h5>
      <ol className="space-y-2">
        {steps.map((step, idx) => (
          <li key={idx} className="text-sm text-gray-700">
            <span className="inline-block w-5 h-5 bg-blue-100 text-blue-700 rounded-full text-center text-xs font-semibold leading-5 mr-2">
              {idx + 1}
            </span>
            {step}
          </li>
        ))}
      </ol>
    </div>
  );
}
