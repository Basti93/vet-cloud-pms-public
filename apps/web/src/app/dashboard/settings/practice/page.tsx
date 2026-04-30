"use client";

import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc/client";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Globe, ExternalLink, CheckCircle, Save, Trash2, AlertTriangle, ChevronDown, Copy, Check } from "lucide-react";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1.5">{label}</label>
      {children}
    </div>
  );
}

function TextInput({
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full px-3 py-2 rounded-lg border text-sm"
      style={{
        borderColor: "var(--color-border)",
        backgroundColor: "var(--color-bg)",
        color: "var(--color-fg)",
      }}
    />
  );
}

export default function PracticePage() {
  const router = useRouter();
  const { data: tenant } = trpc.tenant.getCurrent.useQuery();
  const { data: embedCode } = trpc.booking.getEmbedCode.useQuery(
    { slug: tenant?.slug || "" },
    { enabled: !!tenant?.slug }
  );
  const update = trpc.tenant.update.useMutation();
  const deletePractice = trpc.tenant.delete.useMutation();

  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    postalCode: "",
    tagline: "",
    monogram: "",
    allowedEmbeddingDomains: [] as string[],
  });
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  const [newDomain, setNewDomain] = useState("");
  const [embedType, setEmbedType] = useState<"iframe" | "modal">("iframe");
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  useEffect(() => {
    if (tenant) {
      setForm({
        name: tenant.name || "",
        email: tenant.email || "",
        phone: tenant.phone || "",
        address: tenant.address || "",
        city: tenant.city || "",
        postalCode: tenant.postalCode || "",
        tagline: tenant.tagline || "",
        monogram: tenant.monogram || "",
        allowedEmbeddingDomains: ((tenant as any).allowedEmbeddingDomains as string[]) || [],
      });
    }
  }, [tenant]);

  const set = (field: keyof typeof form) => (v: string) =>
    setForm((prev) => ({ ...prev, [field]: v }));

  const handleSave = () => {
    update.mutate(form, {
      onSuccess: () => {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      },
    });
  };

  const websiteUrl = tenant?.slug
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/${tenant.slug}`
    : null;

  const handleCopyCode = (code: string, index: number) => {
    navigator.clipboard.writeText(code);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const currentEmbedCode = embedCode ? (embedType === "iframe" ? embedCode.iframeCode : embedCode.modalCode) : "";

  return (
    <div className="max-w-2xl space-y-6">
      {/* Website-Status */}
      <Card className="p-5" style={{ borderColor: "var(--color-border)" }}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: "var(--color-accent-soft)" }}
            >
              <Globe size={18} style={{ color: "var(--color-accent)" }} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm">Öffentliche Website</span>
                <span
                  className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium"
                  style={{ backgroundColor: "#dcfce7", color: "#166534" }}
                >
                  <CheckCircle size={11} />
                  Aktiv
                </span>
              </div>
              <p className="text-xs mt-0.5" style={{ color: "var(--color-muted)" }}>
                Ihre Praxis ist öffentlich unter folgender URL erreichbar
              </p>
              {websiteUrl && (
                <code
                  className="text-xs mt-1.5 block px-2 py-1 rounded"
                  style={{ backgroundColor: "var(--color-bg)", color: "var(--color-accent)" }}
                >
                  {websiteUrl}
                </code>
              )}
            </div>
          </div>
          {websiteUrl && (
            <a
              href={websiteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-shrink-0"
            >
              <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                <ExternalLink size={13} />
                Öffnen
              </Button>
            </a>
          )}
        </div>
        <p className="text-xs mt-3 pt-3" style={{ borderTop: "1px solid var(--color-border)", color: "var(--color-muted)" }}>
          Die Website nutzt die Daten aus diesem Formular sowie das Erscheinungsbild aus dem{" "}
          <a href="/dashboard/settings/appearance" style={{ color: "var(--color-accent)" }}>
            Erscheinungsbild-Tab
          </a>
          .
        </p>
      </Card>

      {/* Praxisinformationen */}
      <Card className="p-6" style={{ borderColor: "var(--color-border)" }}>
        <h2 className="text-base font-semibold mb-5">Praxisinformationen</h2>
        <div className="space-y-4">
          <Field label="Praxisname">
            <TextInput value={form.name} onChange={set("name")} placeholder="Tierarztpraxis Dr. Müller" />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="E-Mail">
              <TextInput value={form.email} onChange={set("email")} type="email" placeholder="praxis@example.de" />
            </Field>
            <Field label="Telefon">
              <TextInput value={form.phone} onChange={set("phone")} placeholder="+49 30 123456" />
            </Field>
          </div>

          <Field label="Straße & Hausnummer">
            <TextInput value={form.address} onChange={set("address")} placeholder="Musterstraße 1" />
          </Field>

          <div className="grid grid-cols-3 gap-4">
            <Field label="PLZ">
              <TextInput value={form.postalCode} onChange={set("postalCode")} placeholder="10115" />
            </Field>
            <div className="col-span-2">
              <Field label="Stadt">
                <TextInput value={form.city} onChange={set("city")} placeholder="Berlin" />
              </Field>
            </div>
          </div>

          <div className="border-t pt-4 mt-4" style={{ borderColor: "var(--color-border)" }}>
            <h3 className="text-sm font-medium mb-4" style={{ color: "var(--color-fg)" }}>Branding</h3>
            <div className="space-y-4">
              <Field label="Tagline (optional)">
                <TextInput value={form.tagline} onChange={set("tagline")} placeholder="z.B. Ihre Tierarztpraxis vor Ort" />
              </Field>
              <Field label="Monogramm (optional)">
                <TextInput value={form.monogram.slice(0, 3)} onChange={(v) => set("monogram")(v.slice(0, 3).toUpperCase())} placeholder="z.B. DM" />
              </Field>
            </div>
          </div>
        </div>

        <div className="mt-6 flex items-center gap-3">
          <Button onClick={handleSave} disabled={update.isPending} className="gap-2">
            <Save size={15} />
            {update.isPending ? "Wird gespeichert..." : "Speichern"}
          </Button>
          {saveSuccess && (
            <span className="flex items-center gap-1.5 text-sm" style={{ color: "#166534" }}>
              <CheckCircle size={15} />
              Gespeichert
            </span>
          )}
        </div>
      </Card>

      {/* How to include booking */}
      <Card className="p-6" style={{ borderColor: "var(--color-border)" }}>
        <button
          onClick={() => setExpandedSections(prev => ({ ...prev, booking: !prev.booking }))}
          className="w-full flex items-center justify-between gap-3 hover:opacity-75 transition-opacity"
        >
          <h2 className="text-base font-semibold">Wie binde ich die Online-Terminbuchung ein?</h2>
          <ChevronDown
            size={20}
            style={{
              transform: expandedSections.booking ? "rotate(180deg)" : "rotate(0deg)",
              transition: "transform 0.2s",
            }}
          />
        </button>

        {expandedSections.booking && (
          <div className="mt-4 pt-4 border-t space-y-4" style={{ borderColor: "var(--color-border)" }}>
            <div className="text-sm">
              <p style={{ color: "var(--color-muted)" }} className="mb-3">
                Wählen Sie eine Einbindungsmethode und kopieren Sie den Code für Ihre Website:
              </p>

              {/* Embed type selector */}
              <div className="flex gap-2 mb-4">
                <button
                  onClick={() => setEmbedType("iframe")}
                  className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                    embedType === "iframe"
                      ? "text-gray-900"
                      : "text-gray-600"
                  }`}
                  style={{
                    backgroundColor: embedType === "iframe" ? "var(--primary)" : "var(--color-bg)",
                  }}
                >
                  iframe (Eingebettet)
                </button>
                <button
                  onClick={() => setEmbedType("modal")}
                  className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                    embedType === "modal"
                      ? "text-gray-900"
                      : "text-gray-600"
                  }`}
                  style={{
                    backgroundColor: embedType === "modal" ? "var(--primary)" : "var(--color-bg)",
                  }}
                >
                  Modal (Popup-Dialog)
                </button>
              </div>

              {/* Code display */}
              {currentEmbedCode && (
                <div className="space-y-2">
                  <p className="text-xs font-medium" style={{ color: "var(--color-muted)" }}>
                    {embedType === "iframe"
                      ? "Fügen Sie diesen Code an der gewünschten Stelle Ihrer Website ein:"
                      : "Fügen Sie diesen Code am Ende Ihres HTML (vor </body>) ein:"}
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
                      {currentEmbedCode}
                    </pre>
                    <button
                      onClick={() => handleCopyCode(currentEmbedCode, 0)}
                      className="absolute top-2 right-2 p-2 rounded hover:opacity-75 transition-opacity"
                      style={{ backgroundColor: "var(--color-bg)", color: "var(--color-accent)" }}
                    >
                      {copiedIndex === 0 ? (
                        <Check size={14} style={{ color: "#16a34a" }} />
                      ) : (
                        <Copy size={14} />
                      )}
                    </button>
                  </div>
                </div>
              )}

              <div className="mt-4 p-3 rounded text-xs" style={{ backgroundColor: "var(--color-accent-soft)" }}>
                <p style={{ color: "var(--color-muted)" }}>
                  <strong>💡 Tipp:</strong> Der Code nutzt automatisch Ihre Praxisinformationen, den Buchungslink und das Farbschema aus Ihren Einstellungen.
                </p>
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* Allowed embedding domains */}
      <Card className="p-6" style={{ borderColor: "var(--color-border)" }}>
        <h2 className="text-base font-semibold mb-4">Erlaubte Einbindungsdomänen</h2>
        <p style={{ color: "var(--color-muted)" }} className="text-sm mb-4">
          Nur diese Domains dürfen die Buchungs-Widget einbinden. Lassen Sie leer, um von überall zuzulassen.
        </p>

        <div className="space-y-3">
          {form.allowedEmbeddingDomains.length > 0 && (
            <div className="space-y-2">
              {form.allowedEmbeddingDomains.map((domain, idx) => (
                <div key={idx} className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg" style={{ backgroundColor: "var(--color-bg)" }}>
                  <span className="flex-1 text-sm">{domain}</span>
                  <button
                    onClick={() => setForm(prev => ({
                      ...prev,
                      allowedEmbeddingDomains: prev.allowedEmbeddingDomains.filter((_, i) => i !== idx)
                    }))}
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
              onKeyDown={(e) => {
                if (e.key === "Enter" && newDomain.trim()) {
                  setForm(prev => ({
                    ...prev,
                    allowedEmbeddingDomains: [...prev.allowedEmbeddingDomains, newDomain.trim()]
                  }));
                  setNewDomain("");
                }
              }}
            />
            <button
              onClick={() => {
                if (newDomain.trim()) {
                  setForm(prev => ({
                    ...prev,
                    allowedEmbeddingDomains: [...prev.allowedEmbeddingDomains, newDomain.trim()]
                  }));
                  setNewDomain("");
                }
              }}
              className="px-3 py-2 rounded-lg text-sm font-medium"
              style={{ backgroundColor: "var(--color-accent)", color: "white" }}
            >
              Hinzufügen
            </button>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t" style={{ borderColor: "var(--color-border)" }}>
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
            <span className="flex items-center gap-1.5 text-sm mt-2" style={{ color: "#166534" }}>
              <CheckCircle size={14} />
              Gespeichert
            </span>
          )}
        </div>
      </Card>

      {/* Danger Zone */}
      <Card
        className="p-6 border-red-200"
        style={{
          borderColor: "#fca5a5",
          backgroundColor: "rgba(127, 29, 29, 0.05)"
        }}
      >
        <div className="flex items-start gap-3 mb-4">
          <AlertTriangle size={20} style={{ color: "#dc2626" }} className="flex-shrink-0 mt-0.5" />
          <div>
            <h2 className="text-base font-semibold" style={{ color: "#dc2626" }}>Gefahrenzone</h2>
            <p className="text-sm mt-1" style={{ color: "var(--color-muted)" }}>
              Löschen Sie diese Praxis dauerhaft. Diese Aktion kann nicht rückgängig gemacht werden.
            </p>
          </div>
        </div>

        {!showDeleteConfirm ? (
          <Button
            variant="destructive"
            onClick={() => setShowDeleteConfirm(true)}
            className="gap-2"
            style={{ backgroundColor: "#dc2626", color: "white" }}
          >
            <Trash2 size={15} />
            Praxis löschen
          </Button>
        ) : (
          <div className="space-y-4">
            <p className="text-sm" style={{ color: "var(--color-fg)" }}>
              Geben Sie den Praxisnamen ein, um zu bestätigen:
            </p>
            <div>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder={tenant?.name || "Praxisname"}
                className="w-full px-3 py-2 rounded-lg border text-sm"
                style={{
                  borderColor: deleteConfirmText === tenant?.name ? "#dc2626" : "var(--color-border)",
                  backgroundColor: "var(--color-bg)",
                  color: "var(--color-fg)",
                }}
              />
            </div>
            <div className="flex gap-3">
              <Button
                onClick={() => {
                  if (deleteConfirmText === tenant?.name && tenant?.id) {
                    deletePractice.mutate(
                      { tenantId: tenant.id },
                      {
                        onSuccess: () => {
                          setTimeout(() => router.push("/"), 1000);
                        },
                      }
                    );
                  }
                }}
                disabled={deleteConfirmText !== tenant?.name || deletePractice.isPending}
                style={{
                  backgroundColor: "#dc2626",
                  color: "white",
                  opacity: deleteConfirmText === tenant?.name ? 1 : 0.5,
                }}
              >
                {deletePractice.isPending ? "Wird gelöscht..." : "Ja, löschen"}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeleteConfirmText("");
                }}
                disabled={deletePractice.isPending}
              >
                Abbrechen
              </Button>
            </div>
            {deletePractice.error && (
              <p className="text-sm" style={{ color: "#dc2626" }}>
                Fehler: {deletePractice.error.message}
              </p>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
