"use client";

import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Globe, ExternalLink, CheckCircle, Save, Pencil, PlusCircle } from "lucide-react";
import { EmbedHelpSection } from "@/components/settings/EmbedHelpSection";

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
  const { data: tenant } = trpc.tenant.getCurrent.useQuery();
  const { data: deletionStatus } = trpc.tenant.getDeletionStatus.useQuery();
  const { data: embedCode } = trpc.booking.getEmbedCode.useQuery(
    { slug: tenant?.slug || "" },
    { enabled: !!tenant?.slug }
  );
  const update = trpc.tenant.update.useMutation();
  const { data: websiteProjects, isLoading: websitesLoading } = trpc.websitePlatform.listProjects.useQuery();

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
  const [newDomain, setNewDomain] = useState("");

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
        allowedEmbeddingDomains:
          (tenant as { allowedEmbeddingDomains?: string[] }).allowedEmbeddingDomains || [],
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

  const websiteProject = websiteProjects?.[0];
  const websiteUrl = websiteProject?.slug
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/site/${websiteProject.slug}`
    : null;
  const websiteStatusLabel = websiteProject?.status === "published" ? "Aktiv" : websiteProject ? "Entwurf" : "Nicht eingerichtet";
  const websiteStatusClass = websiteProject?.status === "published"
    ? "bg-green-100 text-green-800"
    : websiteProject
      ? "bg-amber-100 text-amber-800"
      : "bg-muted text-muted-foreground";

  return (
    <div className="max-w-2xl space-y-6">
      {deletionStatus?.isDeactivationScheduled && deletionStatus.scheduledFor && (
        <Card className="p-5 border-red-200 bg-red-50">
          <h2 className="text-base font-semibold text-red-700">Deaktivierung aktiv</h2>
          <p className="mt-1 text-sm text-red-800">
            Diese Praxis ist pausiert. Endgültige Löschung geplant für{" "}
            {new Date(deletionStatus.scheduledFor).toLocaleDateString("de-DE")}.
          </p>
        </Card>
      )}

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
                  className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${websiteStatusClass}`}
                >
                  {websiteProject?.status === "published" && <CheckCircle size={11} />}
                  {websitesLoading ? "Lädt…" : websiteStatusLabel}
                </span>
              </div>
              <p className="text-xs mt-0.5" style={{ color: "var(--color-muted)" }}>
                Inhalte, Layout, Medien, Veröffentlichung und Domains werden im Website-Studio verwaltet.
              </p>
              {websiteUrl ? (
                <code
                  className="text-xs mt-1.5 block px-2 py-1 rounded"
                  style={{ backgroundColor: "var(--color-bg)", color: "var(--color-accent)" }}
                >
                  {websiteUrl}
                </code>
              ) : (
                <p className="text-xs mt-1.5" style={{ color: "var(--color-muted)" }}>
                  Für diese Praxis wurde noch keine Website angelegt.
                </p>
              )}
            </div>
          </div>
          <div className="flex flex-shrink-0 flex-wrap justify-end gap-2">
            {websiteUrl && (
              <a href={websiteUrl} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                  <ExternalLink size={13} />
                  Öffnen
                </Button>
              </a>
            )}
            {websiteProject ? (
              <a href={`/dashboard/websites/${websiteProject.id}/editor`}>
                <Button variant="default" size="sm" className="gap-1.5 text-xs">
                  <Pencil size={13} />
                  Im Studio bearbeiten
                </Button>
              </a>
            ) : (
              <a href="/dashboard/websites">
                <Button variant="default" size="sm" className="gap-1.5 text-xs">
                  <PlusCircle size={13} />
                  Website erstellen
                </Button>
              </a>
            )}
          </div>
        </div>
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
      <EmbedHelpSection embedCode={embedCode} />

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

    </div>
  );
}
