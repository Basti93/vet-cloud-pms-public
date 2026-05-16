"use client";

import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Globe, ExternalLink, CheckCircle, Save, Pencil, PlusCircle, Copy, RefreshCw, Lock } from "lucide-react";

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
  const update = trpc.tenant.update.useMutation();
  const generatePreviewToken = trpc.tenant.generatePreviewToken.useMutation();
  const utils = trpc.useUtils();
  const { data: websiteProjects, isLoading: websitesLoading } = trpc.websitePlatform.listProjects.useQuery();
  const [copiedPreview, setCopiedPreview] = useState(false);

  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    postalCode: "",
    tagline: "",
    monogram: "",
  });
  const [saveSuccess, setSaveSuccess] = useState(false);

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

      {/* Website */}
      <Card className="p-5" style={{ borderColor: "var(--color-border)" }}>
        {/* Row 1: Studio info + actions */}
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
                <span className="font-semibold text-sm">Website & Buchung</span>
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

        {/* Divider */}
        <div className="my-4 border-t" style={{ borderColor: "var(--color-border)" }} />

        {/* Row 2: Activate toggle */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <span className="text-sm font-medium">Öffentlich aktivieren</span>
            <p className="text-xs mt-0.5" style={{ color: "var(--color-muted)" }}>
              Wenn aktiv, ist Buchungsseite und Website öffentlich erreichbar und wird von Suchmaschinen indexiert.
            </p>
          </div>
          {tenant?.subscriptionStatus !== "active" ? (
            <div className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-amber-50 text-amber-700 border border-amber-200">
              <Lock size={12} />
              Erfordert aktives Abonnement
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                update.mutate(
                  { websiteEnabled: !tenant.websiteEnabled },
                  { onSuccess: () => utils.tenant.getCurrent.invalidate() }
                );
              }}
              disabled={update.isPending}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${
                tenant?.websiteEnabled ? "bg-green-500" : "bg-gray-300"
              }`}
              role="switch"
              aria-checked={tenant?.websiteEnabled ?? false}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ${
                  tenant?.websiteEnabled ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          )}
        </div>

        {/* Row 3: Preview URLs */}
        <div className="mt-4 pt-4 border-t" style={{ borderColor: "var(--color-border)" }}>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium" style={{ color: "var(--color-muted)" }}>
              Vorschau-Links (auch ohne aktive Website zugänglich)
            </p>
            <button
              type="button"
              onClick={() => generatePreviewToken.mutate(undefined, { onSuccess: () => utils.tenant.getCurrent.invalidate() })}
              disabled={generatePreviewToken.isPending}
              className="flex items-center gap-1 text-xs hover:opacity-70 transition-opacity"
              style={{ color: "var(--color-muted)" }}
              title="Neuen Token generieren"
            >
              <RefreshCw size={12} className={generatePreviewToken.isPending ? "animate-spin" : ""} />
              {tenant?.previewToken ? "Neu generieren" : "Token generieren"}
            </button>
          </div>
          {tenant?.previewToken ? (
            <div className="space-y-2">
              {[
                { label: "Website", path: websiteProject?.slug ? `/site/${websiteProject.slug}` : null },
                { label: "Buchung", path: `/book/${tenant.slug}` },
              ].filter((item): item is { label: string; path: string } => Boolean(item.path)).map(({ label, path }) => {
                const url = `${typeof window !== "undefined" ? window.location.origin : ""}${path}?preview=${tenant.previewToken}`;
                return (
                  <div key={path} className="flex items-center gap-2">
                    <span className="text-xs w-12 flex-shrink-0" style={{ color: "var(--color-muted)" }}>{label}</span>
                    <code
                      className="flex-1 text-xs px-2 py-1.5 rounded truncate"
                      style={{ backgroundColor: "var(--color-bg)", color: "var(--color-accent)" }}
                    >
                      {url}
                    </code>
                    <button
                      type="button"
                      onClick={() => {
                        void navigator.clipboard.writeText(url);
                        setCopiedPreview(true);
                        setTimeout(() => setCopiedPreview(false), 2000);
                      }}
                      className="flex-shrink-0 p-1.5 rounded hover:bg-gray-100 transition-colors"
                      title="Kopieren"
                    >
                      {copiedPreview ? <CheckCircle size={14} className="text-green-600" /> : <Copy size={14} />}
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="text-xs gap-1.5"
              onClick={() => generatePreviewToken.mutate(undefined, { onSuccess: () => utils.tenant.getCurrent.invalidate() })}
              disabled={generatePreviewToken.isPending}
            >
              <RefreshCw size={13} className={generatePreviewToken.isPending ? "animate-spin" : ""} />
              Vorschau-Link generieren
            </Button>
          )}
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

    </div>
  );
}
