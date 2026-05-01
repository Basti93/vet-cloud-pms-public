"use client";

import { useState, useEffect } from "react";
import { useLocale } from "@/lib/user/preferences-context";
import { locales } from "@/i18n.config";
import { Globe, Calendar, Clock, Trash2, Plus } from "lucide-react";
import { SelectField } from "@/components/forms/SelectField";
import { SettingsSection } from "@/components/forms/SettingsSection";
import { DayRow, type DaySchedule } from "@/components/forms/DayRow";
import { trpc } from "@/lib/trpc/client";
import { Card } from "@/components/ui/card";
import { PERMISSIONS } from "@/lib/db/schema";

const localeNames: Record<string, string> = {
  de: "Deutsch",
  en: "English",
};

const DAYS_OF_WEEK = [
  { label: "Montag", value: 1 },
  { label: "Dienstag", value: 2 },
  { label: "Mittwoch", value: 3 },
  { label: "Donnerstag", value: 4 },
  { label: "Freitag", value: 5 },
  { label: "Samstag", value: 6 },
  { label: "Sonntag", value: 0 },
];

function getToday() {
  return new Date().toISOString().split("T")[0];
}

interface TimeSlot {
  startHour: number;
  startMin: number;
  endHour: number;
  endMin: number;
}

export default function UserSettingsPage() {
  const { locale, setLocale } = useLocale();
  const [localLocale, setLocalLocale] = useState(locale);
  const [isDirty, setIsDirty] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [successMessage, setSuccessMessage] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(false);

  const { data: tenant } = trpc.tenant.getCurrent.useQuery();
  const { data: permissions } = trpc.admin.getUserPermissions.useQuery();
  const { data: currentUser } = trpc.admin.getCurrentUser.useQuery();

  const isVet = permissions?.includes(PERMISSIONS.SCHEDULE_MANAGE);

  // Get utils at top level (before hooks)
  const utils = trpc.useUtils();

  // Sync context locale to local state when component mounts
  useEffect(() => {
    setLocalLocale(locale);
  }, [locale]);

  // Vet-specific queries and mutations
  const { data: vetSchedule = [] } = trpc.user.getVetSchedule.useQuery(
    undefined,
    { enabled: !!isVet }
  );

  const { data: vetAbsences = [] } = trpc.user.getVetAbsences.useQuery(
    undefined,
    { enabled: !!isVet }
  );

  const [slotDurationEdit, setSlotDurationEdit] = useState<number | null>(null);
  const [durationSaved, setDurationSaved] = useState(false);

  const [scheduleEdits, setScheduleEdits] = useState<
    Record<number, DaySchedule>
  >({});
  const [scheduleSaved, setScheduleSaved] = useState(false);
  const todayStr = getToday();
  const currentYear = new Date().getFullYear();
  const [absenceFilterYear, setAbsenceFilterYear] = useState(currentYear);

  const [newAbsence, setNewAbsence] = useState<{
    startDate: string;
    endDate: string;
    type: "vacation" | "sick" | "other";
    note?: string;
  }>({
    startDate: todayStr,
    endDate: todayStr,
    type: "vacation",
    note: "",
  });

  // Note: setLocale handles the mutation internally
  // We just track UI state (isDirty, error, successMessage)

  const updateScheduleMutation = trpc.user.updateVetScheduleDay.useMutation({
    onSuccess: () => {
      setScheduleSaved(true);
      setTimeout(() => setScheduleSaved(false), 2000);
      utils.user.getVetSchedule.invalidate();
    },
    onError: (err) => {
      setError(err.message || "Fehler beim Speichern");
    },
  });

  const addAbsenceMutation = trpc.user.addVetAbsence.useMutation({
    onSuccess: () => {
      setNewAbsence({
        startDate: todayStr,
        endDate: todayStr,
        type: "vacation",
        note: "",
      });
      utils.user.getVetAbsences.invalidate();
    },
    onError: (err) => {
      setError(err.message || "Fehler beim Hinzufügen");
    },
  });

  const removeAbsenceMutation = trpc.user.removeVetAbsence.useMutation({
    onSuccess: () => {
      utils.user.getVetAbsences.invalidate();
    },
    onError: (err) => {
      setError(err.message || "Fehler beim Löschen");
    },
  });

  const updateSlotDurationMutation = trpc.user.updateSlotDuration.useMutation({
    onSuccess: () => {
      setDurationSaved(true);
      setTimeout(() => setDurationSaved(false), 2000);
      utils.admin.getCurrentUser.invalidate();
      utils.user.getVetSchedule.invalidate();
      // Also invalidate schedule queries from Praxisverwaltung
      utils.schedule.getVetSchedules.invalidate();
    },
    onError: (err) => {
      setError(err.message || "Fehler beim Speichern");
    },
  });

  const handleLocaleChange = (newLocale: string) => {
    setLocalLocale(newLocale as "de" | "en");
    setIsDirty(true);
    setError(undefined);
    setSuccessMessage(undefined);
  };

  const handleSaveLocale = async () => {
    setIsLoading(true);
    try {
      await setLocale(localLocale as "de" | "en");
      setIsDirty(false);
      setError(undefined);
      setSuccessMessage("Sprache erfolgreich gespeichert");
      setTimeout(() => setSuccessMessage(undefined), 3000);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Fehler beim Speichern der Sprache";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetLocale = () => {
    setLocalLocale(locale);
    setIsDirty(false);
    setError(undefined);
    setSuccessMessage(undefined);
  };

  return (
    <div className="max-w-2xl space-y-6">
      {/* Language Settings */}
      <SettingsSection
        title="Sprache"
        description="Wählen Sie die Sprache für Ihr Benutzererlebnis"
        icon={<Globe size={20} style={{ color: "var(--color-accent)" }} />}
        isDirty={isDirty}
        isLoading={isLoading}
        error={error}
        successMessage={successMessage}
        onSave={handleSaveLocale}
        onReset={handleResetLocale}
      >
        <SelectField
          label="Bevorzugte Sprache"
          value={localLocale}
          onChange={handleLocaleChange}
          options={locales.map((lang) => ({
            label: localeNames[lang],
            value: lang,
          }))}
        />
      </SettingsSection>

      {/* Vet-only sections */}
      {isVet && (
        <>
          {/* Availability Settings */}
          <Card className="p-6 border" style={{ borderColor: "var(--color-accent-soft)" }}>
            <div className="flex items-center gap-3 mb-6">
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: "var(--color-accent-soft)" }}
              >
                <Clock size={20} style={{ color: "var(--color-accent)" }} />
              </div>
              <div>
                <h2 className="text-base font-semibold">Verfügbarkeitszeiten</h2>
                <p className="text-sm" style={{ color: "var(--color-muted)" }}>
                  Legen Sie Ihre wöchentlichen Arbeitszeiten fest
                </p>
              </div>
            </div>

            <div className="mb-6 pb-6 border-b" style={{ borderColor: "var(--color-border)" }}>
              <label className="text-xs font-medium block mb-2" style={{ color: "var(--color-muted)" }}>
                Terminminimaldauer (Minuten)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="5"
                  max="480"
                  step="5"
                  value={slotDurationEdit !== null ? slotDurationEdit : currentUser?.slotDurationMin ?? 30}
                  onChange={(e) => setSlotDurationEdit(parseInt(e.target.value) || 30)}
                  className="w-20 text-sm border rounded px-2 py-1"
                  style={{ backgroundColor: "var(--color-surface)", borderColor: "var(--color-border)", color: "var(--color-fg)" }}
                />
                <button
                  onClick={() => {
                    updateSlotDurationMutation.mutate({
                      slotDurationMin: slotDurationEdit !== null ? slotDurationEdit : currentUser?.slotDurationMin ?? 30,
                    });
                    setSlotDurationEdit(null);
                  }}
                  disabled={updateSlotDurationMutation.isPending}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                  style={{ backgroundColor: "var(--color-accent)" }}
                >
                  {updateSlotDurationMutation.isPending ? "Wird gespeichert…" : "Speichern"}
                </button>
                {durationSaved && (
                  <span className="flex items-center gap-1.5 text-sm text-green-600">
                    ✓ Gespeichert
                  </span>
                )}
              </div>
            </div>

            <div className="divide-y" style={{ borderColor: "var(--color-border)" }}>
              {[1, 2, 3, 4, 5, 6, 0].map((dayOfWeek) => {
                const schedule = vetSchedule.find(
                  (s) => s.dayOfWeek === dayOfWeek
                );
                const slots = (schedule?.slots || []) as TimeSlot[];
                const dayEdit = scheduleEdits[dayOfWeek];
                const dayToDisplay: DaySchedule = dayEdit || {
                  dayOfWeek,
                  slots,
                };

                return (
                  <DayRow
                    key={dayOfWeek}
                    day={dayToDisplay}
                    onChange={(updated) => {
                      setScheduleEdits((prev) => ({
                        ...prev,
                        [dayOfWeek]: updated,
                      }));
                    }}
                    disabled={updateScheduleMutation.isPending}
                  />
                );
              })}
            </div>

            <div className="flex items-center gap-3 pt-4 mt-4 border-t" style={{ borderColor: "var(--color-border)" }}>
              <button
                onClick={async () => {
                  for (const dayOfWeek of [1, 2, 3, 4, 5, 6, 0]) {
                    const dayEdit = scheduleEdits[dayOfWeek];
                    if (dayEdit) {
                      await updateScheduleMutation.mutateAsync({
                        dayOfWeek,
                        slots: dayEdit.slots,
                      });
                    }
                  }
                  setScheduleEdits({});
                }}
                disabled={
                  updateScheduleMutation.isPending ||
                  Object.keys(scheduleEdits).length === 0
                }
                className="px-4 py-2 rounded-lg text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                style={{ backgroundColor: "var(--color-accent)" }}
              >
                {updateScheduleMutation.isPending ? "Wird gespeichert…" : "Alle speichern"}
              </button>
              {scheduleSaved && (
                <span className="flex items-center gap-1.5 text-sm text-green-600">
                  ✓ Gespeichert
                </span>
              )}
            </div>
          </Card>

          {/* Absence Settings */}
          <Card className="p-6 border" style={{ borderColor: "var(--color-accent-soft)" }}>
            <div className="flex items-center gap-3 mb-6">
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: "var(--color-accent-soft)" }}
              >
                <Calendar size={20} style={{ color: "var(--color-accent)" }} />
              </div>
              <div>
                <h2 className="text-base font-semibold">Urlaub & Abwesenheit</h2>
                <p className="text-sm" style={{ color: "var(--color-muted)" }}>
                  Verwalten Sie Ihre Abwesenheitszeiten
                </p>
              </div>
            </div>

            {/* Add Absence Form */}
            <div className="space-y-3 p-4 rounded-lg mb-6" style={{ backgroundColor: "var(--color-surface)" }}>
              <p className="text-sm font-medium">Neue Abwesenheit hinzufügen</p>
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="date"
                  value={newAbsence?.startDate || ""}
                  onChange={(e) =>
                    setNewAbsence({ ...newAbsence, startDate: e.target.value } as any)
                  }
                  className="p-2 rounded border text-sm"
                  style={{ borderColor: "var(--color-border)" }}
                  placeholder="Von"
                />
                <input
                  type="date"
                  value={newAbsence?.endDate || ""}
                  onChange={(e) =>
                    setNewAbsence({ ...newAbsence, endDate: e.target.value } as any)
                  }
                  className="p-2 rounded border text-sm"
                  style={{ borderColor: "var(--color-border)" }}
                  placeholder="Bis"
                />
              </div>
              <select
                value={newAbsence?.type || "vacation"}
                onChange={(e) =>
                  setNewAbsence({
                    ...newAbsence,
                    type: e.target.value as any,
                  } as any)
                }
                className="w-full p-2 rounded border text-sm"
                style={{ borderColor: "var(--color-border)" }}
              >
                <option value="vacation">Urlaub</option>
                <option value="sick">Krankheit</option>
                <option value="other">Sonstiges</option>
              </select>
              <textarea
                value={newAbsence?.note || ""}
                onChange={(e) =>
                  setNewAbsence({ ...newAbsence, note: e.target.value } as any)
                }
                className="w-full p-2 rounded border text-sm"
                style={{ borderColor: "var(--color-border)" }}
                placeholder="Notiz (optional)"
                rows={2}
              />
              <button
                onClick={() => {
                  if (
                    newAbsence?.startDate &&
                    newAbsence?.endDate &&
                    newAbsence?.type
                  ) {
                    addAbsenceMutation.mutateAsync({
                      startDate: newAbsence.startDate,
                      endDate: newAbsence.endDate,
                      type: newAbsence.type,
                      note: newAbsence.note,
                    });
                  }
                }}
                disabled={
                  !newAbsence?.startDate ||
                  !newAbsence?.endDate ||
                  addAbsenceMutation.isPending
                }
                className="w-full flex items-center justify-center gap-2 p-2 rounded text-sm font-medium transition-colors"
                style={{
                  backgroundColor: "var(--color-accent)",
                  color: "white",
                  opacity:
                    !newAbsence?.startDate ||
                    !newAbsence?.endDate ||
                    addAbsenceMutation.isPending
                      ? 0.5
                      : 1,
                }}
              >
                <Plus size={16} />
                Hinzufügen
              </button>
            </div>

            {/* List Absences */}
            {vetAbsences.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">Abwesenheitshistorie</p>
                  <select
                    value={absenceFilterYear}
                    onChange={(e) => setAbsenceFilterYear(parseInt(e.target.value))}
                    className="p-2 rounded border text-sm"
                    style={{ borderColor: "var(--color-border)" }}
                  >
                    {Array.from({ length: 10 }, (_, i) => currentYear - i).map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  {vetAbsences
                    .filter((absence) => {
                      const startYear = new Date(absence.startDate).getFullYear();
                      const endYear = new Date(absence.endDate).getFullYear();
                      return startYear === absenceFilterYear || endYear === absenceFilterYear;
                    })
                    .map((absence) => (
                  <div
                    key={absence.id}
                    className="flex items-center justify-between p-3 rounded-lg"
                    style={{
                      backgroundColor: "var(--color-surface)",
                      borderColor: "var(--color-border)",
                      border: "1px solid",
                    }}
                  >
                    <div className="flex-1">
                      <p className="text-sm font-medium">
                        {new Date(absence.startDate).toLocaleDateString("de-DE")} -{" "}
                        {new Date(absence.endDate).toLocaleDateString("de-DE")}
                      </p>
                      <p className="text-xs" style={{ color: "var(--color-muted)" }}>
                        {absence.type === "vacation"
                          ? "Urlaub"
                          : absence.type === "sick"
                          ? "Krankheit"
                          : "Sonstiges"}
                      </p>
                      {absence.note && (
                        <p className="text-xs mt-1" style={{ color: "var(--color-muted)" }}>
                          {absence.note}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() =>
                        removeAbsenceMutation.mutateAsync({ absenceId: absence.id })
                      }
                      disabled={removeAbsenceMutation.isPending}
                      className="p-2 hover:opacity-80"
                      style={{ color: "var(--color-error)" }}
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                ))}
                </div>
              </div>
            )}
          </Card>
        </>
      )}

      {/* Placeholder for future features */}
      <Card className="p-6" style={{ borderColor: "var(--color-border)" }}>
        <h2 className="text-base font-semibold mb-2">Weitere Kontooptionen</h2>
        <p className="text-sm" style={{ color: "var(--color-muted)" }}>
          Passwort, E-Mail-Adresse und Kontolöschung werden in Kürze hinzugefügt.
        </p>
      </Card>
    </div>
  );
}
