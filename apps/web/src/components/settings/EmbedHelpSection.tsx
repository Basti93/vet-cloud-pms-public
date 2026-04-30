"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { Card } from "@/components/ui/card";

interface EmbedHelpSectionProps {
  embedCode?: {
    iframeCode: string;
    modalCode: string;
  };
}

export function EmbedHelpSection({ embedCode }: EmbedHelpSectionProps) {
  const [activeTab, setActiveTab] = useState<"iframe" | "modal">("iframe");
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const handleCopyCode = (code: string, index: number) => {
    navigator.clipboard.writeText(code);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const embedTabs = [
    { id: "iframe" as const, label: "iframe (Eingebettet)" },
    { id: "modal" as const, label: "Modal (Popup-Dialog)" },
  ];

  return (
    <Card className="p-6" style={{ borderColor: "var(--color-border)" }}>
      <h2 className="text-base font-semibold mb-4">
        Wie binde ich die Online-Terminbuchung ein?
      </h2>

      <div className="text-sm">
        <p
          style={{ color: "var(--color-muted)" }}
          className="mb-4"
        >
          Wählen Sie eine Einbindungsmethode und kopieren Sie den Code für Ihre
          Website:
        </p>

        {/* Tab buttons using Tabs component styling */}
        <div
          className="border-b overflow-x-auto mb-4"
          style={{ borderColor: "var(--color-border)" }}
        >
          <div className="flex gap-1 min-w-min">
            {embedTabs.map(({ id, label }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className="px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px whitespace-nowrap"
                style={{
                  borderColor:
                    activeTab === id ? "var(--color-accent)" : "transparent",
                  color:
                    activeTab === id
                      ? "var(--color-accent)"
                      : "var(--color-muted)",
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Code display */}
        {embedCode && (
          <div className="space-y-2">
            {activeTab === "iframe" && (
              <>
                <p
                  className="text-xs font-medium"
                  style={{ color: "var(--color-muted)" }}
                >
                  Fügen Sie diesen Code an der gewünschten Stelle Ihrer Website
                  ein:
                </p>
                <div className="relative">
                  <pre
                    className="px-3 py-3 rounded-lg text-xs overflow-x-auto"
                    style={{
                      backgroundColor: "var(--color-bg)",
                      color: "var(--color-accent)",
                      fontFamily: "monospace",
                    }}
                  >
                    {embedCode.iframeCode}
                  </pre>
                  <button
                    onClick={() => handleCopyCode(embedCode.iframeCode, 0)}
                    className="absolute top-2 right-2 p-2 rounded hover:opacity-75 transition-opacity"
                    style={{
                      backgroundColor: "var(--color-bg)",
                      color: "var(--color-accent)",
                    }}
                    title="Code kopieren"
                  >
                    {copiedIndex === 0 ? (
                      <Check size={14} style={{ color: "#16a34a" }} />
                    ) : (
                      <Copy size={14} />
                    )}
                  </button>
                </div>
              </>
            )}

            {activeTab === "modal" && (
              <>
                <p
                  className="text-xs font-medium"
                  style={{ color: "var(--color-muted)" }}
                >
                  Fügen Sie diesen Code am Ende Ihres HTML (vor &lt;/body&gt;)
                  ein:
                </p>
                <div className="relative">
                  <pre
                    className="px-3 py-3 rounded-lg text-xs overflow-x-auto"
                    style={{
                      backgroundColor: "var(--color-bg)",
                      color: "var(--color-accent)",
                      fontFamily: "monospace",
                    }}
                  >
                    {embedCode.modalCode}
                  </pre>
                  <button
                    onClick={() => handleCopyCode(embedCode.modalCode, 1)}
                    className="absolute top-2 right-2 p-2 rounded hover:opacity-75 transition-opacity"
                    style={{
                      backgroundColor: "var(--color-bg)",
                      color: "var(--color-accent)",
                    }}
                    title="Code kopieren"
                  >
                    {copiedIndex === 1 ? (
                      <Check size={14} style={{ color: "#16a34a" }} />
                    ) : (
                      <Copy size={14} />
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        <div
          className="mt-4 p-3 rounded text-xs"
          style={{ backgroundColor: "var(--color-accent-soft)" }}
        >
          <p style={{ color: "var(--color-muted)" }}>
            <strong>💡 Tipp:</strong> Der Code nutzt automatisch Ihre
            Praxisinformationen, den Buchungslink und das Farbschema aus Ihren
            Einstellungen.
          </p>
        </div>
      </div>
    </Card>
  );
}
