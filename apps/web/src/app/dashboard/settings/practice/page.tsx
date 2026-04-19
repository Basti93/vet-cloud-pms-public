"use client";

import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Globe, ExternalLink, CheckCircle, Save } from "lucide-react";

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
  const update = trpc.tenant.update.useMutation();

  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    postalCode: "",
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
