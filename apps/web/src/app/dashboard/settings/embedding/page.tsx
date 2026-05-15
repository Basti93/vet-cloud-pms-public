"use client";

import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc/client";
import { Card } from "@/components/ui/card";
import { CheckCircle, Save } from "lucide-react";
import { EmbedHelpSection } from "@/components/settings/EmbedHelpSection";

export default function EmbeddingPage() {
  const { data: tenant } = trpc.tenant.getCurrent.useQuery();
  const { data: embedCode } = trpc.booking.getEmbedCode.useQuery(
    { slug: tenant?.slug || "" },
    { enabled: !!tenant?.slug }
  );
  const update = trpc.tenant.update.useMutation();

  const [allowedEmbeddingDomains, setAllowedEmbeddingDomains] = useState<string[]>([]);
  const [newDomain, setNewDomain] = useState("");
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    if (tenant) {
      setAllowedEmbeddingDomains(
        (tenant as { allowedEmbeddingDomains?: string[] }).allowedEmbeddingDomains || []
      );
    }
  }, [tenant]);

  const handleSave = () => {
    update.mutate({ allowedEmbeddingDomains }, {
      onSuccess: () => {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      },
    });
  };

  const addDomain = () => {
    const trimmed = newDomain.trim();
    if (!trimmed) return;
    setAllowedEmbeddingDomains(prev => [...prev, trimmed]);
    setNewDomain("");
  };

  return (
    <div className="max-w-2xl space-y-6">
      <EmbedHelpSection embedCode={embedCode} />

      <Card className="p-6" style={{ borderColor: "var(--color-border)" }}>
        <h2 className="text-base font-semibold mb-4">Erlaubte Einbindungsdomänen</h2>
        <p style={{ color: "var(--color-muted)" }} className="text-sm mb-4">
          Nur diese Domains dürfen die Buchungs-Widget einbinden. Lassen Sie leer, um von überall zuzulassen.
        </p>

        <div className="space-y-3">
          {allowedEmbeddingDomains.length > 0 && (
            <div className="space-y-2">
              {allowedEmbeddingDomains.map((domain, idx) => (
                <div key={idx} className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ backgroundColor: "var(--color-bg)" }}>
                  <span className="flex-1 text-sm">{domain}</span>
                  <button
                    onClick={() => setAllowedEmbeddingDomains(prev => prev.filter((_, i) => i !== idx))}
                    className="text-red-500 text-sm hover:underline"
                  >
                    Entfernen
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            <input
              type="text"
              value={newDomain}
              onChange={(e) => setNewDomain(e.target.value)}
              placeholder="z.B. tierarzt-praxis.de, www.tierarzt-praxis.de"
              className="flex-1 px-3 py-2 rounded-lg border text-sm"
              style={{
                borderColor: "var(--color-border)",
                backgroundColor: "var(--color-bg)",
                color: "var(--color-fg)",
              }}
              onKeyDown={(e) => { if (e.key === "Enter") addDomain(); }}
            />
            <button
              onClick={addDomain}
              className="px-3 py-2 rounded-lg text-sm font-medium"
              style={{ backgroundColor: "var(--color-accent)", color: "white" }}
            >
              Hinzufügen
            </button>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t flex items-center gap-3" style={{ borderColor: "var(--color-border)" }}>
          <button
            onClick={handleSave}
            disabled={update.isPending}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium"
            style={{ backgroundColor: "var(--color-accent)", color: "white" }}
          >
            <Save size={14} />
            {update.isPending ? "Wird gespeichert..." : "Speichern"}
          </button>
          {saveSuccess && (
            <span className="flex items-center gap-1.5 text-sm" style={{ color: "#166534" }}>
              <CheckCircle size={14} />
              Gespeichert
            </span>
          )}
        </div>
      </Card>
    </div>
  );
}
