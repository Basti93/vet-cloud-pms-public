"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Tabs } from "@/components/ui/tabs";

interface EmbedHelpSectionProps {
  embedCode?: {
    iframeCode: string;
    modalCode: string;
  };
}

export function EmbedHelpSection({ embedCode }: EmbedHelpSectionProps) {
  const [activeTabIndex, setActiveTabIndex] = useState(0);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const handleCopyCode = (code: string, index: number) => {
    navigator.clipboard.writeText(code);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const embedTabs = [
    { label: "iframe (Eingebettet)" },
    { label: "Modal (Popup-Dialog)" },
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

        {/* Use Tabs component in content mode */}
        <div className="mb-4">
          <Tabs
            tabs={embedTabs}
            activeTabIndex={activeTabIndex}
            onTabChange={setActiveTabIndex}
          />
        </div>

        {/* Code display */}
        {embedCode && (
          <div className="space-y-2">
            {activeTabIndex === 0 && (
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

            {activeTabIndex === 1 && (
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
