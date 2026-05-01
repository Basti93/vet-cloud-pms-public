"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Copy, Download } from "lucide-react";

export default function CalendarExportPage() {
  const [copiedTokenId, setCopiedTokenId] = useState<string | null>(null);

  const { data: tokens, isLoading, error } = trpc.calendar.listTokens.useQuery();
  const { data: currentUser } = trpc.admin.getCurrentUser.useQuery();
  const { data: tenant } = trpc.tenant.getCurrent.useQuery();

  const generateTokenMutation = trpc.calendar.generateToken.useMutation({
    onSuccess: () => refetchTokens(),
  });
  const revokeTokenMutation = trpc.calendar.revokeToken.useMutation({
    onSuccess: () => refetchTokens(),
  });
  const { refetch: refetchTokens } = trpc.calendar.listTokens.useQuery();

  // Check if user is a vet
  const typedError = error as { code?: string; message?: string } | null;
  const isVetError = typedError?.code === "VET_ONLY" || typedError?.message?.includes("veterinarian");
  if (isVetError) {
    return (
      <div className="max-w-2xl">
        <p className="text-gray-600">
          Diese Funktion ist nur für Tierärzte verfügbar. Nur Tierärzte mit eigenen Terminen können einen persönlichen Kalender-Link erstellen.
        </p>
      </div>
    );
  }

  const handleGenerateToken = () => {
    generateTokenMutation.mutate({});
  };

  const handleCopyUrl = (token: string) => {
    if (!tenant?.slug || !currentUser?.id) return;
    const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
    const iCalUrl = `${baseUrl}/api/calendar/${tenant.slug}/${currentUser.id}.ics?token=${token}`;
    navigator.clipboard.writeText(iCalUrl);
    setCopiedTokenId(token);
    setTimeout(() => setCopiedTokenId(null), 2000);
  };

  const handleDownload = (token: string) => {
    if (!tenant?.slug || !currentUser?.id) return;
    const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
    const iCalUrl = `${baseUrl}/api/calendar/${tenant.slug}/${currentUser.id}?token=${token}`;
    window.location.href = iCalUrl;
  };

  return (
    <div className="space-y-8 max-w-3xl">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-fg">Kalender-Synchronisierung</h1>
        <p className="text-muted">
          Exportieren Sie Ihre Termine als iCalendar-Feed (ICS) für Google Calendar, Outlook, Apple Calendar und andere Kalender-Anwendungen.
        </p>
      </div>

      {/* Generate Token */}
      <div className="bg-surface rounded-lg border border-[var(--color-border)] p-6">
        <Button
          onClick={handleGenerateToken}
          disabled={generateTokenMutation.isPending}
          style={{ backgroundColor: 'var(--color-accent)' }}
          className="text-white"
        >
          {generateTokenMutation.isPending ? "Wird generiert..." : "Neuen Feed-Link generieren"}
        </Button>
      </div>

      {/* Tokens List */}
      {isLoading ? (
        <p className="text-gray-500">Wird geladen...</p>
      ) : !tokens || tokens.length === 0 ? (
        <div className="p-4 rounded-lg bg-yellow-50 border border-yellow-200 text-yellow-800 text-sm">
          Noch keine Kalender-Feeds erstellt. Generieren Sie oben einen neuen Feed-Link.
        </div>
      ) : (
        <div className="space-y-3">
          <h2 className="font-bold text-fg">Aktive Feeds ({tokens.length})</h2>
          {tokens.map((token) => (
            <div
              key={token.id}
              className="bg-surface rounded-lg border border-[var(--color-border)] p-4 space-y-3"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="font-medium text-fg">{token.description || 'Kalender-Feed'}</p>
                  <p className="text-xs text-muted mt-1">
                    Erstellt: {new Date(token.createdAt).toLocaleDateString('de-DE')}
                    {token.lastUsedAt && ` • Zuletzt verwendet: ${new Date(token.lastUsedAt).toLocaleDateString('de-DE')}`}
                  </p>
                </div>
              </div>

              {/* Feed URL */}
              <div className="bg-bg rounded p-3 font-mono text-xs break-all text-muted overflow-x-auto">
                {tenant?.slug && currentUser?.id
                  ? `${typeof window !== "undefined" ? window.location.origin : ""}/api/calendar/${tenant.slug}/${currentUser.id}?token=${token.token}`
                  : "Wird geladen..."}
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <button
                  onClick={() => handleCopyUrl(token.token)}
                  className="flex-1 px-4 py-2 rounded-lg text-sm font-medium border border-[var(--color-border)] hover:bg-surface transition flex items-center justify-center gap-2"
                >
                  <Copy size={16} />
                  {copiedTokenId === token.token ? 'Kopiert!' : 'Link kopieren'}
                </button>
                <button
                  onClick={() => handleDownload(token.token)}
                  className="flex-1 px-4 py-2 rounded-lg text-sm font-medium border border-[var(--color-border)] hover:bg-surface transition flex items-center justify-center gap-2"
                  title="ICS-Datei herunterladen"
                >
                  <Download size={16} />
                  Download
                </button>
                <button
                  onClick={() => {
                    if (confirm("Feed wirklich löschen?")) {
                      revokeTokenMutation.mutate({ tokenId: token.id });
                    }
                  }}
                  disabled={revokeTokenMutation.isPending}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-red-600 border border-red-200 hover:bg-red-50 transition disabled:opacity-50"
                >
                  Löschen
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Important Notes */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 text-blue-900 space-y-2 text-sm">
        <p className="font-bold">Wichtige Hinweise</p>
        <ul className="list-disc list-inside space-y-1">
          <li>Der Feed wird alle 15 Minuten aktualisiert</li>
          <li>Der Feed ist schreibgeschützt (Änderungen müssen hier in der App vorgenommen werden)</li>
          <li>Teilen Sie den Feed-Link nur mit vertrauenswürdigen Personen</li>
        </ul>
      </div>
    </div>
  );
}
