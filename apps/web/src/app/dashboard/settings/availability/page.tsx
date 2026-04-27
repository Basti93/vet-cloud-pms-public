'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc/client';
import { Clock, User, CalendarOff, Plus, Trash2, CheckCircle, ChevronDown, ChevronUp, X } from 'lucide-react';
import type { DaySchedule, TimeRange } from '@/lib/schedule-types';

const DAY_NAMES = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
const DAY_SHORT = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
// Display order: Mon first
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

const ABSENCE_TYPES = [
  { value: 'vacation', label: 'Urlaub' },
  { value: 'sick', label: 'Krankmeldung' },
  { value: 'other', label: 'Sonstiges' },
] as const;

// Time options at 30-min increments
const TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => {
  const h = Math.floor(i / 2);
  const m = i % 2 === 0 ? 0 : 30;
  return { h, m, label: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}` };
});

function TimeSelect({ hour, min, onChange }: { hour: number; min: number; onChange: (h: number, m: number) => void }) {
  const value = `${hour}:${min}`;
  return (
    <select
      value={value}
      onChange={(e) => {
        const [h, m] = e.target.value.split(':').map(Number);
        onChange(h, m);
      }}
      className="text-sm border rounded px-2 py-1"
      style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)', color: 'var(--color-fg)' }}
    >
      {TIME_OPTIONS.map((t) => (
        <option key={t.label} value={`${t.h}:${t.m}`}>{t.label}</option>
      ))}
    </select>
  );
}

function emptyDay(dayOfWeek: number): DaySchedule {
  return { dayOfWeek, slots: [] };
}

function defaultDay(dayOfWeek: number): DaySchedule {
  // Mon–Fri default open 08–18, weekends closed
  if (dayOfWeek >= 1 && dayOfWeek <= 5) {
    return { dayOfWeek, slots: [{ startHour: 8, startMin: 0, endHour: 18, endMin: 0 }] };
  }
  return emptyDay(dayOfWeek);
}

// ── Day schedule editor (reusable for both practice hours and vet schedules) ──

function DayRow({
  day,
  onChange,
}: {
  day: DaySchedule;
  onChange: (updated: DaySchedule) => void;
}) {
  const isOpen = day.slots.length > 0;

  function toggleOpen() {
    if (isOpen) {
      onChange({ ...day, slots: [] });
    } else {
      onChange({ ...day, slots: [{ startHour: 8, startMin: 0, endHour: 18, endMin: 0 }] });
    }
  }

  function updateSlot(i: number, field: keyof TimeRange, h: number, m?: number) {
    const newSlots = day.slots.map((s, idx) =>
      idx === i ? { ...s, [field]: field.endsWith('Min') ? (m ?? 0) : h, ...(m !== undefined && field.startsWith('start') ? { startMin: m } : {}), ...(m !== undefined && field.startsWith('end') ? { endMin: m } : {}) } : s
    );
    // Handle paired hour+min update
    const slots = day.slots.map((s, idx) => {
      if (idx !== i) return s;
      if (field === 'startHour') return { ...s, startHour: h, startMin: m ?? s.startMin };
      if (field === 'endHour') return { ...s, endHour: h, endMin: m ?? s.endMin };
      return s;
    });
    onChange({ ...day, slots });
  }

  function addSlot() {
    const last = day.slots[day.slots.length - 1];
    const newStart = last ? last.endHour * 60 + last.endMin + 60 : 8 * 60;
    const h = Math.min(Math.floor(newStart / 60), 22);
    const m = newStart % 60 === 0 ? 0 : 30;
    onChange({ ...day, slots: [...day.slots, { startHour: h, startMin: m, endHour: h + 2, endMin: m }] });
  }

  function removeSlot(i: number) {
    onChange({ ...day, slots: day.slots.filter((_, idx) => idx !== i) });
  }

  function setSlotTime(i: number, which: 'start' | 'end', h: number, m: number) {
    onChange({
      ...day,
      slots: day.slots.map((s, idx) =>
        idx !== i ? s : which === 'start'
          ? { ...s, startHour: h, startMin: m }
          : { ...s, endHour: h, endMin: m }
      ),
    });
  }

  return (
    <div className="flex items-start gap-3 py-2">
      <span className="w-8 text-sm font-medium pt-1.5" style={{ color: 'var(--color-fg)' }}>
        {DAY_SHORT[day.dayOfWeek]}
      </span>

      {/* Toggle */}
      <button
        onClick={toggleOpen}
        className="relative inline-flex h-5 w-9 items-center rounded-full transition-colors flex-shrink-0 mt-1.5"
        style={{ backgroundColor: isOpen ? 'var(--color-accent)' : 'var(--color-border)' }}
      >
        <span
          className="inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform"
          style={{ transform: isOpen ? 'translateX(18px)' : 'translateX(2px)' }}
        />
      </button>

      {!isOpen ? (
        <span className="text-sm pt-1" style={{ color: 'var(--color-muted)' }}>Geschlossen</span>
      ) : (
        <div className="flex flex-col gap-1.5 flex-1">
          {day.slots.map((slot, i) => (
            <div key={i} className="flex items-center gap-2">
              <TimeSelect
                hour={slot.startHour} min={slot.startMin}
                onChange={(h, m) => setSlotTime(i, 'start', h, m)}
              />
              <span className="text-sm" style={{ color: 'var(--color-muted)' }}>–</span>
              <TimeSelect
                hour={slot.endHour} min={slot.endMin}
                onChange={(h, m) => setSlotTime(i, 'end', h, m)}
              />
              {day.slots.length > 1 && (
                <button onClick={() => removeSlot(i)} className="p-0.5 hover:opacity-70" style={{ color: 'var(--color-muted)' }}>
                  <X size={14} />
                </button>
              )}
            </div>
          ))}
          <button
            onClick={addSlot}
            className="flex items-center gap-1 text-xs mt-0.5 hover:opacity-70"
            style={{ color: 'var(--color-accent)' }}
          >
            <Plus size={12} /> Zeitraum hinzufügen
          </button>
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AvailabilityPage() {
  const utils = trpc.useUtils();
  const tenant = trpc.tenant.getCurrent.useQuery();
  const tenantId = tenant.data?.id ?? '';

  // ── Practice hours ──────────────────────────────────────────────────────────
  const practiceHoursQuery = trpc.schedule.getPracticeHours.useQuery(
    { tenantId },
    { enabled: !!tenantId }
  );
  const updatePracticeHours = trpc.schedule.updatePracticeHours.useMutation({
    onSuccess: () => {
      utils.schedule.getPracticeHours.invalidate({ tenantId });
      setPracticeSaved(true);
      setTimeout(() => setPracticeSaved(false), 2000);
    },
  });
  const [practiceSaved, setPracticeSaved] = useState(false);
  const [practiceEdits, setPracticeEdits] = useState<DaySchedule[] | null>(null);
  const practiceHours = practiceEdits ?? practiceHoursQuery.data ?? DAY_ORDER.map(defaultDay);

  // ── Vet schedules ───────────────────────────────────────────────────────────
  const vetSchedulesQuery = trpc.schedule.getVetSchedules.useQuery(
    { tenantId },
    { enabled: !!tenantId }
  );
  const upsertVetDay = trpc.schedule.upsertVetDaySchedule.useMutation({
    onSuccess: () => utils.schedule.getVetSchedules.invalidate({ tenantId }),
  });
  const [expandedVet, setExpandedVet] = useState<string | null>(null);
  const [vetSaved, setVetSaved] = useState<string | null>(null);
  // vetEdits: vetId → dayOfWeek → DaySchedule
  const [vetEdits, setVetEdits] = useState<Record<string, Record<number, DaySchedule>>>({});

  function getVetDay(vetId: string, dayOfWeek: number, serverSchedule: { dayOfWeek: number; slots: TimeRange[] }[]): DaySchedule {
    if (vetEdits[vetId]?.[dayOfWeek]) return vetEdits[vetId][dayOfWeek];
    const s = serverSchedule.find((s) => s.dayOfWeek === dayOfWeek);
    if (s) return { dayOfWeek, slots: s.slots };
    return defaultDay(dayOfWeek);
  }

  function updateVetDay(vetId: string, updated: DaySchedule) {
    setVetEdits((prev) => ({
      ...prev,
      [vetId]: { ...prev[vetId], [updated.dayOfWeek]: updated },
    }));
  }

  async function saveVetSchedule(vetId: string, serverSchedule: { dayOfWeek: number; slots: TimeRange[] }[]) {
    await Promise.all(
      DAY_ORDER.map((day) => {
        const d = getVetDay(vetId, day, serverSchedule);
        return upsertVetDay.mutateAsync({ tenantId, vetId, dayOfWeek: day, slots: d.slots });
      })
    );
    setVetSaved(vetId);
    setTimeout(() => setVetSaved(null), 2000);
  }

  // ── Absences ────────────────────────────────────────────────────────────────
  const absencesQuery = trpc.schedule.getAbsences.useQuery(
    { tenantId },
    { enabled: !!tenantId }
  );
  const createAbsence = trpc.schedule.createAbsence.useMutation({
    onSuccess: () => { utils.schedule.getAbsences.invalidate({ tenantId }); setNewAbsence(null); },
  });
  const deleteAbsence = trpc.schedule.deleteAbsence.useMutation({
    onSuccess: () => utils.schedule.getAbsences.invalidate({ tenantId }),
  });
  const [newAbsence, setNewAbsence] = useState<{
    vetId: string; startDate: string; endDate: string; type: 'vacation' | 'sick' | 'other'; note: string;
  } | null>(null);

  const allVets = vetSchedulesQuery.data?.map((v) => v.vet) ?? [];

  if (!tenantId || tenant.isLoading) {
    return <div className="text-sm" style={{ color: 'var(--color-muted)' }}>Wird geladen…</div>;
  }

  return (
    <div className="space-y-8 max-w-3xl">

      {/* ── Practice Opening Hours ─────────────────────────────────────────── */}
      <section className="rounded-xl border p-6 space-y-4"
        style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg" style={{ backgroundColor: 'var(--color-accent-soft)' }}>
            <Clock size={18} style={{ color: 'var(--color-accent)' }} />
          </div>
          <div>
            <h2 className="font-semibold text-base">Öffnungszeiten der Praxis</h2>
            <p className="text-sm" style={{ color: 'var(--color-muted)' }}>
              Rahmen für Online-Buchungen — mehrere Zeiträume pro Tag möglich
            </p>
          </div>
        </div>

        {practiceHoursQuery.isLoading ? (
          <div className="text-sm" style={{ color: 'var(--color-muted)' }}>Wird geladen…</div>
        ) : (
          <div className="divide-y" style={{ borderColor: 'var(--color-border)' }}>
            {DAY_ORDER.map((dayOfWeek) => {
              const day = practiceHours.find((d) => d.dayOfWeek === dayOfWeek) ?? defaultDay(dayOfWeek);
              return (
                <DayRow
                  key={dayOfWeek}
                  day={day}
                  onChange={(updated) => {
                    const base = practiceEdits ?? practiceHoursQuery.data ?? DAY_ORDER.map(defaultDay);
                    setPracticeEdits(base.map((d) => d.dayOfWeek === dayOfWeek ? updated : d));
                  }}
                />
              );
            })}
          </div>
        )}

        <div className="flex items-center gap-3 pt-1">
          <button
            onClick={() => updatePracticeHours.mutate({ tenantId, hours: practiceHours as any })}
            disabled={updatePracticeHours.isPending}
            className="px-4 py-2 rounded-lg text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: 'var(--color-accent)' }}
          >
            {updatePracticeHours.isPending ? 'Wird gespeichert…' : 'Speichern'}
          </button>
          {practiceSaved && (
            <span className="flex items-center gap-1.5 text-sm text-green-600">
              <CheckCircle size={15} /> Gespeichert
            </span>
          )}
        </div>
      </section>

      {/* ── Vet Schedules ──────────────────────────────────────────────────── */}
      <section className="rounded-xl border p-6 space-y-4"
        style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg" style={{ backgroundColor: 'var(--color-accent-soft)' }}>
            <User size={18} style={{ color: 'var(--color-accent)' }} />
          </div>
          <div>
            <h2 className="font-semibold text-base">Arbeitszeiten der Tierärzte</h2>
            <p className="text-sm" style={{ color: 'var(--color-muted)' }}>
              Individuelle Wochenzeiten — überschreiben die Praxis-Öffnungszeiten
            </p>
          </div>
        </div>

        {vetSchedulesQuery.isLoading ? (
          <div className="text-sm" style={{ color: 'var(--color-muted)' }}>Wird geladen…</div>
        ) : vetSchedulesQuery.data?.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--color-muted)' }}>Keine Tierärzte gefunden.</p>
        ) : (
          <div className="space-y-2">
            {vetSchedulesQuery.data?.map(({ vet, schedule }) => (
              <div key={vet.id} className="border rounded-lg overflow-hidden"
                style={{ borderColor: 'var(--color-border)' }}>
                <button
                  className="w-full flex items-center justify-between px-4 py-3 text-left hover:opacity-80 transition-opacity"
                  style={{ backgroundColor: 'var(--color-bg)' }}
                  onClick={() => setExpandedVet(expandedVet === vet.id ? null : vet.id)}
                >
                  <span className="font-medium text-sm">
                    {vet.title ? `${vet.title} ` : ''}{vet.firstName} {vet.lastName}
                    <span className="ml-2 text-xs font-normal" style={{ color: 'var(--color-muted)' }}>
                      {vet.role === 'admin' ? 'Praxisinhaber' : 'Tierarzt'}
                    </span>
                  </span>
                  {expandedVet === vet.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>

                {expandedVet === vet.id && (
                  <div className="px-4 pb-4 pt-1 space-y-1"
                    style={{ borderTopWidth: 1, borderColor: 'var(--color-border)' }}>
                    <div className="divide-y" style={{ borderColor: 'var(--color-border)' }}>
                      {DAY_ORDER.map((dayOfWeek) => (
                        <DayRow
                          key={dayOfWeek}
                          day={getVetDay(vet.id, dayOfWeek, schedule)}
                          onChange={(updated) => updateVetDay(vet.id, updated)}
                        />
                      ))}
                    </div>
                    <div className="flex items-center gap-3 pt-3">
                      <button
                        onClick={() => saveVetSchedule(vet.id, schedule)}
                        disabled={upsertVetDay.isPending}
                        className="px-4 py-2 rounded-lg text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                        style={{ backgroundColor: 'var(--color-accent)' }}
                      >
                        {upsertVetDay.isPending ? 'Wird gespeichert…' : 'Speichern'}
                      </button>
                      {vetSaved === vet.id && (
                        <span className="flex items-center gap-1.5 text-sm text-green-600">
                          <CheckCircle size={15} /> Gespeichert
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Absences ───────────────────────────────────────────────────────── */}
      <section className="rounded-xl border p-6 space-y-4"
        style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg" style={{ backgroundColor: 'var(--color-accent-soft)' }}>
              <CalendarOff size={18} style={{ color: 'var(--color-accent)' }} />
            </div>
            <div>
              <h2 className="font-semibold text-base">Abwesenheiten</h2>
              <p className="text-sm" style={{ color: 'var(--color-muted)' }}>
                Urlaub, Krankheit — blockiert Online-Buchungen automatisch
              </p>
            </div>
          </div>
          <button
            onClick={() => setNewAbsence({
              vetId: allVets[0]?.id ?? '',
              startDate: '', endDate: '',
              type: 'vacation', note: '',
            })}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-white"
            style={{ backgroundColor: 'var(--color-accent)' }}
          >
            <Plus size={15} /> Hinzufügen
          </button>
        </div>

        {newAbsence && (
          <div className="border rounded-lg p-4 space-y-3"
            style={{ borderColor: 'var(--color-accent)', backgroundColor: 'var(--color-accent-soft)' }}>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: 'var(--color-muted)' }}>Tierarzt</label>
                <select value={newAbsence.vetId} onChange={(e) => setNewAbsence({ ...newAbsence, vetId: e.target.value })}
                  className="w-full text-sm border rounded px-2 py-1.5"
                  style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)', color: 'var(--color-fg)' }}>
                  {allVets.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.title ? `${v.title} ` : ''}{v.firstName} {v.lastName}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: 'var(--color-muted)' }}>Art</label>
                <select value={newAbsence.type} onChange={(e) => setNewAbsence({ ...newAbsence, type: e.target.value as any })}
                  className="w-full text-sm border rounded px-2 py-1.5"
                  style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)', color: 'var(--color-fg)' }}>
                  {ABSENCE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: 'var(--color-muted)' }}>Von</label>
                <input type="date" value={newAbsence.startDate}
                  onChange={(e) => setNewAbsence({ ...newAbsence, startDate: e.target.value })}
                  className="w-full text-sm border rounded px-2 py-1.5"
                  style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)', color: 'var(--color-fg)' }} />
              </div>
              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: 'var(--color-muted)' }}>Bis</label>
                <input type="date" value={newAbsence.endDate} min={newAbsence.startDate}
                  onChange={(e) => setNewAbsence({ ...newAbsence, endDate: e.target.value })}
                  className="w-full text-sm border rounded px-2 py-1.5"
                  style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)', color: 'var(--color-fg)' }} />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium block mb-1" style={{ color: 'var(--color-muted)' }}>Notiz (optional)</label>
              <input type="text" placeholder="z.B. Sommerurlaub" value={newAbsence.note}
                onChange={(e) => setNewAbsence({ ...newAbsence, note: e.target.value })}
                className="w-full text-sm border rounded px-2 py-1.5"
                style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)', color: 'var(--color-fg)' }} />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  if (!newAbsence.vetId || !newAbsence.startDate || !newAbsence.endDate) return;
                  createAbsence.mutate({ tenantId, ...newAbsence, note: newAbsence.note || undefined });
                }}
                disabled={createAbsence.isPending || !newAbsence.startDate || !newAbsence.endDate}
                className="px-3 py-1.5 rounded-lg text-sm font-medium text-white disabled:opacity-50"
                style={{ backgroundColor: 'var(--color-accent)' }}
              >
                {createAbsence.isPending ? 'Wird gespeichert…' : 'Speichern'}
              </button>
              <button onClick={() => setNewAbsence(null)}
                className="px-3 py-1.5 rounded-lg text-sm font-medium"
                style={{ color: 'var(--color-muted)' }}>
                Abbrechen
              </button>
            </div>
          </div>
        )}

        {absencesQuery.isLoading ? (
          <div className="text-sm" style={{ color: 'var(--color-muted)' }}>Wird geladen…</div>
        ) : absencesQuery.data?.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--color-muted)' }}>Keine bevorstehenden Abwesenheiten.</p>
        ) : (
          <div className="space-y-2">
            {absencesQuery.data?.map((absence) => {
              const typeLabel = ABSENCE_TYPES.find((t) => t.value === absence.type)?.label ?? absence.type;
              const vetName = `${absence.vet.title ? `${absence.vet.title} ` : ''}${absence.vet.firstName} ${absence.vet.lastName}`;
              const dateLabel = absence.startDate === absence.endDate ? absence.startDate : `${absence.startDate} – ${absence.endDate}`;
              return (
                <div key={absence.id} className="flex items-center justify-between px-4 py-3 rounded-lg border"
                  style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg)' }}>
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{vetName}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full" style={{
                        backgroundColor: absence.type === 'sick' ? '#fee2e2' : absence.type === 'vacation' ? '#dbeafe' : '#f3f4f6',
                        color: absence.type === 'sick' ? '#dc2626' : absence.type === 'vacation' ? '#2563eb' : '#6b7280',
                      }}>{typeLabel}</span>
                    </div>
                    <div className="text-xs" style={{ color: 'var(--color-muted)' }}>
                      {dateLabel}{absence.note ? ` · ${absence.note}` : ''}
                    </div>
                  </div>
                  <button onClick={() => deleteAbsence.mutate({ tenantId, absenceId: absence.id })}
                    className="p-1.5 rounded-lg hover:opacity-70 transition-opacity"
                    style={{ color: 'var(--color-muted)' }}>
                    <Trash2 size={15} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
