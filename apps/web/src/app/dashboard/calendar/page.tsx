"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Copy, Check } from "lucide-react";

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
  const isVetError = (error as any)?.code === "VET_ONLY" || error?.message?.includes("veterinarian");
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

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="space-y-2">
        <p className="text-gray-600">
          Erhalten Sie einen privaten Link zu Ihren Terminen. Kopieren Sie den Link und fügen Sie ihn in Google Calendar, Outlook oder Apple Calendar ein.
        </p>
      </div>

      <Button
        onClick={handleGenerateToken}
        disabled={generateTokenMutation.isPending}
      >
        {generateTokenMutation.isPending ? "Wird generiert..." : "Neuen Link generieren"}
      </Button>

      {isLoading ? (
        <p className="text-gray-500">Wird geladen...</p>
      ) : !tokens || tokens.length === 0 ? (
        <p className="text-gray-500">Noch keine Links erstellt.</p>
      ) : (
        <div className="space-y-3">
          {tokens.map((token) => (
            <div
              key={token.id}
              className="flex items-center justify-between p-3 border rounded-lg border-gray-200"
            >
              <div className="text-sm text-gray-600 break-all font-mono text-xs">
                {tenant?.slug && currentUser?.id
                  ? `${typeof window !== "undefined" ? window.location.origin : ""}/api/calendar/${tenant.slug}/${currentUser.id}.ics?token=${token.token}`.substring(0, 50)
                  : "Wird geladen..."}
                ...
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleCopyUrl(token.token)}
                >
                  {copiedTokenId === token.token ? (
                    <>
                      <Check className="w-4 h-4" />
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (confirm("Link löschen?")) {
                      revokeTokenMutation.mutate({ tokenId: token.id });
                    }
                  }}
                  disabled={revokeTokenMutation.isPending}
                >
                  Löschen
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
