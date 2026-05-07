"use client";

import { useEffect, useState } from "react";
import { useTenant } from "@/hooks/useTenant";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/lib/toast/context";
import { Skeleton } from "@/components/ui/skeleton";
import { Check, Pencil, Plus, Trash2, ChevronDown, ChevronUp, X } from "lucide-react";

const SPECIES_OPTIONS = ["Hund", "Katze", "Kaninchen", "Frettchen", "Pferd", "Vogel", "Hamster", "Meerschweinchen", "Reptil", "Fisch", "Sonstiges"];
const CATEGORY_OPTIONS = [
  { value: "core", label: "Core (STIKO)" },
  { value: "recommended", label: "Empfohlen" },
  { value: "non-core", label: "Optional" },
] as const;

export default function VaccinationSettingsPage() {
  const { tenantId } = useTenant();
  const utils = trpc.useUtils();
  const { addToast } = useToast();

  const { data, isLoading } = trpc.vaccinationSettings.get.useQuery(
    { tenantId: tenantId ?? "" },
    { enabled: !!tenantId }
  );

  const updateMutation = trpc.vaccinationSettings.update.useMutation({
    onSuccess: async () => {
      await utils.vaccinationSettings.get.invalidate();
      addToast("Einstellungen gespeichert.", "success");
    },
    onError: () => {
      addToast("Speichern fehlgeschlagen.", "error");
    },
  });

  const testMutation = trpc.vaccinationSettings.sendTestReminder.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        addToast("Test-E-Mail versendet.", "success");
      } else {
        addToast(`Fehler: ${data.error ?? "Unbekannter Fehler"}`, "error");
      }
    },
    onError: () => {
      addToast("Test-E-Mail konnte nicht gesendet werden.", "error");
    },
  });

  const [reminderEnabled, setReminderEnabled] = useState(true);
  const [reminderDaysBefore, setReminderDaysBefore] = useState(30);
  const [remindCore, setRemindCore] = useState(true);
  const [remindRecommended, setRemindRecommended] = useState(true);
  const [remindOptional, setRemindOptional] = useState(false);
  const [remindOverdue, setRemindOverdue] = useState(true);
  const [reminderSubject, setReminderSubject] = useState("Impf-Erinnerung für {petName}");
  const [reminderBody, setReminderBody] = useState("");
  const [testEmail, setTestEmail] = useState("");

  // Type catalogue management
  const [showGlobalTypes, setShowGlobalTypes] = useState(false);
  const [showAddCustom, setShowAddCustom] = useState(false);
  const [customName, setCustomName] = useState("");
  const [customSpecies, setCustomSpecies] = useState("Hund");
  const [customCategory, setCustomCategory] = useState<"core" | "recommended" | "non-core">("recommended");
  const [customInterval, setCustomInterval] = useState(12);
  const [customBatchRequired, setCustomBatchRequired] = useState(false);
  const [customNotes, setCustomNotes] = useState("");

  // Inline editing state for custom types
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editSpecies, setEditSpecies] = useState("Hund");
  const [editCategory, setEditCategory] = useState<"core" | "recommended" | "non-core">("recommended");
  const [editInterval, setEditInterval] = useState(12);
  const [editBatchRequired, setEditBatchRequired] = useState(false);
  const [editNotes, setEditNotes] = useState("");

  const { data: typeConfig, isLoading: typeConfigLoading, refetch: refetchTypeConfig } =
    trpc.vaccinations.getTypeConfig.useQuery(
      { tenantId: tenantId ?? "" },
      { enabled: !!tenantId }
    );

  const setEnabledMutation = trpc.vaccinations.setGlobalTypeEnabled.useMutation({
    onSuccess: async () => { await refetchTypeConfig(); },
    onError: () => addToast("Fehler beim Aktualisieren.", "error"),
  });

  const addCustomMutation = trpc.vaccinations.addCustomType.useMutation({
    onSuccess: async () => {
      await refetchTypeConfig();
      setShowAddCustom(false);
      setCustomName(""); setCustomSpecies("Hund"); setCustomCategory("recommended");
      setCustomInterval(12); setCustomBatchRequired(false); setCustomNotes("");
      addToast("Eigener Impftyp hinzugefügt.", "success");
    },
    onError: () => addToast("Fehler beim Hinzufügen.", "error"),
  });

  const removeCustomMutation = trpc.vaccinations.removeCustomType.useMutation({
    onSuccess: async () => { await refetchTypeConfig(); addToast("Impftyp entfernt.", "success"); },
    onError: () => addToast("Fehler beim Entfernen.", "error"),
  });

  const updateCustomMutation = trpc.vaccinations.updateCustomType.useMutation({
    onSuccess: async () => {
      await refetchTypeConfig();
      setEditingId(null);
      addToast("Impftyp aktualisiert.", "success");
    },
    onError: () => addToast("Fehler beim Speichern.", "error"),
  });

  const startEdit = (ct: { id: string; customName: string | null; customSpecies: string | null; customCategory: string | null; customIntervalMonths: number | null; customRequiresBatchNumber: boolean | null; customNotes: string | null }) => {
    setEditingId(ct.id);
    setEditName(ct.customName ?? "");
    setEditSpecies(ct.customSpecies ?? "Hund");
    setEditCategory((ct.customCategory as "core" | "recommended" | "non-core") ?? "recommended");
    setEditInterval(ct.customIntervalMonths ?? 12);
    setEditBatchRequired(ct.customRequiresBatchNumber ?? false);
    setEditNotes(ct.customNotes ?? "");
  };

  useEffect(() => {
    if (!data) return;
    setReminderEnabled(data.reminderEnabled);
    setReminderDaysBefore(data.reminderDaysBefore);
    setRemindCore(data.remindCore);
    setRemindRecommended(data.remindRecommended);
    setRemindOptional(data.remindOptional);
    setRemindOverdue(data.remindOverdue);
    setReminderSubject(data.reminderSubject);
    setReminderBody(data.reminderBody);
  }, [data]);

  if (!tenantId) {
    return <div className="text-muted">Tenant wird geladen ...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-fg">Impf-Erinnerungen</h2>
        <p className="mt-1 text-sm text-muted">
          Konfiguriere automatische Erinnerungen für fällige Auffrischungsimpfungen.
        </p>

        {isLoading ? (
          <div className="mt-4 space-y-4">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-10 w-40" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-10 w-28" />
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            <label className="flex cursor-pointer items-center gap-3 text-sm text-fg">
              <input
                type="checkbox"
                className="h-4 w-4 accent-[var(--color-accent)]"
                checked={reminderEnabled}
                onChange={(e) => setReminderEnabled(e.target.checked)}
              />
              Impf-Erinnerungen aktivieren
            </label>

            <label className="block text-sm text-fg">
              Tage vor Fälligkeit
              <input
                type="number"
                min={1}
                max={365}
                className="mt-1 w-full rounded-lg border border-border bg-bg px-3 py-2 text-fg focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                value={reminderDaysBefore}
                onChange={(e) => setReminderDaysBefore(Number(e.target.value))}
              />
            </label>

            {/* ── Welche Kategorien erinnert werden ─────────────────────── */}
            <div>
              <p className="text-sm font-medium text-fg mb-2">Welche Impfkategorien werden erinnert?</p>
              <div className="rounded-lg border border-border bg-bg p-3 space-y-2">
                <label className="flex items-center gap-3 text-sm text-fg cursor-pointer">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-[var(--color-accent)]"
                    checked={remindCore}
                    onChange={(e) => setRemindCore(e.target.checked)}
                  />
                  <span>
                    <span className="inline-block h-2 w-2 rounded-full bg-blue-500 mr-1.5 align-middle" />
                    Pflichtimpfungen (Core / STIKO)
                  </span>
                </label>
                <label className="flex items-center gap-3 text-sm text-fg cursor-pointer">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-[var(--color-accent)]"
                    checked={remindRecommended}
                    onChange={(e) => setRemindRecommended(e.target.checked)}
                  />
                  <span>
                    <span className="inline-block h-2 w-2 rounded-full bg-amber-400 mr-1.5 align-middle" />
                    Empfohlene Impfungen
                  </span>
                </label>
                <label className="flex items-center gap-3 text-sm text-fg cursor-pointer">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-[var(--color-accent)]"
                    checked={remindOptional}
                    onChange={(e) => setRemindOptional(e.target.checked)}
                  />
                  <span className="text-muted">Optionale Impfungen (Non-Core)</span>
                </label>
                <p className="text-xs text-muted pt-1 border-t border-border">
                  Impfungen ohne zugeordneten Impftyp werden immer erinnert.
                </p>
              </div>
            </div>

            {/* ── Überfällige erinnern ───────────────────────────────────── */}
            <label className="flex cursor-pointer items-start gap-3 text-sm text-fg">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 accent-[var(--color-accent)]"
                checked={remindOverdue}
                onChange={(e) => setRemindOverdue(e.target.checked)}
              />
              <span>
                Auch für bereits überfällige Impfungen erinnern
                <span className="block text-xs text-muted mt-0.5">
                  Wenn deaktiviert, werden nur Impfungen erinnert, die noch nicht abgelaufen sind.
                </span>
              </span>
            </label>

            <label className="block text-sm text-fg">
              Betreff
              <input
                className="mt-1 w-full rounded-lg border border-border bg-bg px-3 py-2 text-fg focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                value={reminderSubject}
                onChange={(e) => setReminderSubject(e.target.value)}
              />
            </label>

            <label className="block text-sm text-fg">
              Nachricht
              <textarea
                className="mt-1 min-h-[180px] w-full rounded-lg border border-border bg-bg px-3 py-2 text-fg focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                value={reminderBody}
                onChange={(e) => setReminderBody(e.target.value)}
              />
            </label>

            <p className="text-xs text-muted">
              Platzhalter: {"{ownerName}"}, {"{petName}"}, {"{vaccinationType}"}, {"{dueDate}"},{" "}
              {"{clinicName}"}, {"{bookingUrl}"}
            </p>

            <Button
              loading={updateMutation.isPending}
              onClick={() => {
                if (!tenantId) return;
                updateMutation.mutate({
                  tenantId,
                  reminderEnabled,
                  reminderDaysBefore,
                  remindCore,
                  remindRecommended,
                  remindOptional,
                  remindOverdue,
                  reminderSubject,
                  reminderBody,
                });
              }}
            >
              Speichern
            </Button>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
        <h3 className="text-base font-semibold text-fg">Test-Erinnerung senden</h3>
        <p className="mt-1 text-sm text-muted">
          Sende eine Test-E-Mail, um das Erinnerungsformat zu prüfen.
        </p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input
            type="email"
            placeholder="name@beispiel.de"
            className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-fg placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
            value={testEmail}
            onChange={(e) => setTestEmail(e.target.value)}
          />
          <Button
            variant="outline"
            loading={testMutation.isPending}
            disabled={!testEmail}
            onClick={() => {
              if (!tenantId) return;
              testMutation.mutate({ tenantId, emailAddress: testEmail });
            }}
          >
            Test senden
          </Button>
        </div>
      </div>

      {/* ─── Impftypen-Katalog ─────────────────────────────────────────────── */}
      <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-fg">Impftypen-Katalog</h2>
        <p className="mt-1 text-sm text-muted">
          Aktiviere oder deaktiviere STIKO-Standardtypen für diese Praxis und füge eigene Impftypen hinzu.
        </p>

        {typeConfigLoading ? (
          <div className="mt-4 space-y-2">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : (
          <div className="mt-4 space-y-5">
            {/* ── Custom types ──────────────────────────────────────────────── */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-fg">Eigene Impftypen ({typeConfig?.customTypes.length ?? 0})</h3>
                <Button size="sm" variant="outline" onClick={() => setShowAddCustom((v) => !v)}>
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  Hinzufügen
                </Button>
              </div>

              {showAddCustom && (
                <div className="rounded-xl border border-border bg-bg p-4 space-y-3 mb-3">
                  <div className="grid grid-cols-2 gap-3">
                    <label className="block text-xs text-fg col-span-2">
                      Name *
                      <input
                        className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                        placeholder="z.B. Babesiose, Chinchilla-Distemper"
                        value={customName}
                        onChange={(e) => setCustomName(e.target.value)}
                      />
                    </label>
                    <label className="block text-xs text-fg">
                      Tierart *
                      <select
                        className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                        value={customSpecies}
                        onChange={(e) => setCustomSpecies(e.target.value)}
                      >
                        {SPECIES_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </label>
                    <label className="block text-xs text-fg">
                      Kategorie
                      <select
                        className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                        value={customCategory}
                        onChange={(e) => setCustomCategory(e.target.value as typeof customCategory)}
                      >
                        {CATEGORY_OPTIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                      </select>
                    </label>
                    <label className="block text-xs text-fg">
                      Standardintervall (Monate) *
                      <input
                        type="number" min={1} max={120}
                        className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                        value={customInterval}
                        onChange={(e) => setCustomInterval(Number(e.target.value))}
                      />
                    </label>
                    <label className="block text-xs text-fg col-span-2">
                      Hinweis (optional)
                      <input
                        className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                        placeholder="z.B. Nur für Reise in Endemiegebiet"
                        value={customNotes}
                        onChange={(e) => setCustomNotes(e.target.value)}
                      />
                    </label>
                    <label className="flex items-center gap-2 text-xs text-fg col-span-2">
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-[var(--color-accent)]"
                        checked={customBatchRequired}
                        onChange={(e) => setCustomBatchRequired(e.target.checked)}
                      />
                      Chargennummer erforderlich (z.B. für Heimtierausweis)
                    </label>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      loading={addCustomMutation.isPending}
                      disabled={!customName || !customSpecies}
                      onClick={() => {
                        if (!tenantId || !customName) return;
                        addCustomMutation.mutate({
                          tenantId,
                          name: customName,
                          species: customSpecies,
                          category: customCategory,
                          intervalMonths: customInterval,
                          requiresBatchNumber: customBatchRequired,
                          notes: customNotes || undefined,
                        });
                      }}
                    >
                      Speichern
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setShowAddCustom(false)}>
                      Abbrechen
                    </Button>
                  </div>
                </div>
              )}

              {typeConfig?.customTypes.length === 0 && !showAddCustom && (
                <p className="text-sm text-muted">Noch keine eigenen Impftypen.</p>
              )}
              {typeConfig?.customTypes.map((ct) =>
                editingId === ct.id ? (
                  /* ── Inline edit form ─────────────────────────────────── */
                  <div key={ct.id} className="rounded-xl border border-primary/40 bg-bg p-4 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <label className="block text-xs text-fg col-span-2">
                        Name *
                        <input
                          className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                        />
                      </label>
                      <label className="block text-xs text-fg">
                        Tierart *
                        <select
                          className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                          value={editSpecies}
                          onChange={(e) => setEditSpecies(e.target.value)}
                        >
                          {SPECIES_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </label>
                      <label className="block text-xs text-fg">
                        Kategorie
                        <select
                          className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                          value={editCategory}
                          onChange={(e) => setEditCategory(e.target.value as typeof editCategory)}
                        >
                          {CATEGORY_OPTIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                        </select>
                      </label>
                      <label className="block text-xs text-fg">
                        Standardintervall (Monate) *
                        <input
                          type="number" min={1} max={120}
                          className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                          value={editInterval}
                          onChange={(e) => setEditInterval(Number(e.target.value))}
                        />
                      </label>
                      <label className="block text-xs text-fg col-span-2">
                        Hinweis (optional)
                        <input
                          className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                          value={editNotes}
                          onChange={(e) => setEditNotes(e.target.value)}
                        />
                      </label>
                      <label className="flex items-center gap-2 text-xs text-fg col-span-2">
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-[var(--color-accent)]"
                          checked={editBatchRequired}
                          onChange={(e) => setEditBatchRequired(e.target.checked)}
                        />
                        Chargennummer erforderlich
                      </label>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        loading={updateCustomMutation.isPending}
                        disabled={!editName || !editSpecies}
                        onClick={() => {
                          if (!tenantId) return;
                          updateCustomMutation.mutate({
                            tenantId,
                            configId: ct.id,
                            name: editName,
                            species: editSpecies,
                            category: editCategory,
                            intervalMonths: editInterval,
                            requiresBatchNumber: editBatchRequired,
                            notes: editNotes || null,
                          });
                        }}
                      >
                        <Check className="w-3.5 h-3.5 mr-1" />
                        Speichern
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>
                        <X className="w-3.5 h-3.5 mr-1" />
                        Abbrechen
                      </Button>
                    </div>
                  </div>
                ) : (
                  /* ── Read-only row ────────────────────────────────────── */
                  <div key={ct.id} className="flex items-center justify-between rounded-lg border border-border bg-bg px-3 py-2">
                    <div>
                      <span className="text-sm font-medium text-fg">{ct.customName}</span>
                      <span className="ml-2 text-xs text-muted">{ct.customSpecies} · {ct.customIntervalMonths} Mo.</span>
                      {ct.customNotes && <p className="text-xs text-muted mt-0.5">{ct.customNotes}</p>}
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        className="p-1.5 rounded hover:bg-muted-soft text-muted hover:text-fg transition-colors"
                        title="Bearbeiten"
                        onClick={() => startEdit(ct)}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        className="p-1.5 rounded hover:bg-red-50 text-muted hover:text-red-600 transition-colors"
                        title="Löschen"
                        onClick={() => {
                          if (!tenantId) return;
                          removeCustomMutation.mutate({ tenantId, configId: ct.id });
                        }}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )
              )}
            </div>

            {/* ── Global STIKO types ─────────────────────────────────────────── */}
            <div>
              <button
                className="flex items-center gap-2 text-sm font-semibold text-fg hover:text-muted transition-colors"
                onClick={() => setShowGlobalTypes((v) => !v)}
              >
                {showGlobalTypes ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                STIKO-Standardtypen verwalten ({typeConfig?.globalTypes.filter((t) => t.enabled).length ?? "…"} aktiv)
              </button>

              {showGlobalTypes && (
                <div className="mt-3 space-y-1">
                  {(["Hund", "Katze", "Kaninchen", "Frettchen", "Pferd"] as const).map((species) => {
                    const forSpecies = typeConfig?.globalTypes.filter((t) =>
                      t.species.includes(species)
                    ) ?? [];
                    if (forSpecies.length === 0) return null;
                    return (
                      <div key={species}>
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted mt-3 mb-1">{species}</p>
                        {forSpecies.map((t) => (
                          <div key={t.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 mb-1">
                            <div>
                              <span className={`text-sm font-medium ${t.enabled ? "text-fg" : "text-muted line-through"}`}>
                                {t.name}
                              </span>
                              <span className="ml-2 text-xs text-muted">{t.defaultIntervalMonths} Mo.</span>
                            </div>
                            <label className="flex items-center gap-2 cursor-pointer">
                              <span className="text-xs text-muted">{t.enabled ? "Aktiv" : "Aus"}</span>
                              <input
                                type="checkbox"
                                className="h-4 w-4 accent-[var(--color-accent)]"
                                checked={t.enabled}
                                onChange={(e) => {
                                  if (!tenantId) return;
                                  setEnabledMutation.mutate({
                                    tenantId,
                                    vaccinationTypeId: t.id,
                                    enabled: e.target.checked,
                                  });
                                }}
                              />
                            </label>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
