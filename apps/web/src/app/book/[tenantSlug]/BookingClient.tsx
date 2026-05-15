"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { trpc } from "@/lib/trpc/client";
import { useBookingFormState } from "@/hooks/useBookingFormState";
import { useLocale } from "@/lib/user/preferences-context";
import { getSystemDomain } from "@/lib/system-name";
import { trackEvent } from "@/lib/analytics/tracker";
import { AnalyticsEvents } from "@/lib/analytics/events";
import { ChevronLeft, ChevronRight, Check, Phone, MapPin, Clock, Calendar, AlertCircle, Loader2, Stethoscope, PawPrint, Mail } from "lucide-react";
import { COLOR_PRESETS, TYPE_PAIRINGS, type ColorPresetKey, type TypographyPairingKey } from "@/lib/theme";

// ── Types ─────────────────────────────────────────────────────────────────────

type Step = "vet" | "date" | "details" | "confirm" | "success";

interface Slot { start: Date; end: Date }

interface PatientForm {
  name: string;
  species: string;
  breed: string;
  reason: string;
}

interface OwnerForm {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
}

interface VetOption {
  id: string;
  title?: string | null;
  firstName: string | null;
  lastName: string | null;
  appointmentCount?: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const SPECIES_OPTIONS = [
  "Hund", "Katze", "Kaninchen", "Frettchen", "Pferd",
  "Vogel", "Hamster", "Meerschweinchen", "Fisch", "Reptil", "Sonstiges",
];

/**
 * Format vet name with title
 * Examples: "Dr. Max Mueller", "Dr. med. vet. Alexander Weber", "Admin User"
 */
function formatVetName(title: string | null | undefined, firstName: string | null, lastName: string | null): string {
  const parts = [];
  if (title) parts.push(title);
  if (firstName) parts.push(firstName);
  if (lastName) parts.push(lastName);
  return parts.join(" ");
}

function addDays(d: Date, n: number) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

function isWeekend(d: Date) {
  return d.getDay() === 0 || d.getDay() === 6;
}

function getEmbeddingOrigin() {
  if (typeof window === "undefined") return undefined;
  if (!document.referrer) return undefined;
  try {
    return new URL(document.referrer).origin;
  } catch {
    return undefined;
  }
}

function getProviderUrl(origin?: string) {
  if (origin) {
    return origin.endsWith("/") ? origin : `${origin}/`;
  }

  if (typeof window !== "undefined" && window.location?.origin) {
    const currentOrigin = window.location.origin;
    return currentOrigin.endsWith("/") ? currentOrigin : `${currentOrigin}/`;
  }

  const fallbackDomain = getSystemDomain();
  const hasProtocol = /^https?:\/\//i.test(fallbackDomain);
  const asUrl = hasProtocol ? fallbackDomain : `https://${fallbackDomain}`;

  try {
    const normalized = new URL(asUrl).origin;
    return normalized.endsWith("/") ? normalized : `${normalized}/`;
  } catch {
    return asUrl.endsWith("/") ? asUrl : `${asUrl}/`;
  }
}

/** Build next N weekdays starting from tomorrow */
function buildWeekdays(count = 14): Date[] {
  const days: Date[] = [];
  let cursor = addDays(new Date(), 1);
  while (days.length < count) {
    if (!isWeekend(cursor)) days.push(new Date(cursor));
    cursor = addDays(cursor, 1);
  }
  return days;
}

function fmtDate(d: Date) {
  return d.toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "short" });
}
function fmtTime(d: Date) {
  return d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
}
function fmtLong(d: Date) {
  return d.toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StepIndicator({ current }: { current: Step }) {
  const { t } = useLocale();
  const steps: { key: Step; labelKey: string }[] = [
    { key: "vet", labelKey: "booking.steps.vet" },
    { key: "date", labelKey: "booking.steps.date" },
    { key: "details", labelKey: "booking.steps.details" },
    { key: "confirm", labelKey: "booking.steps.confirm" },
  ];
  const idx = steps.findIndex((s) => s.key === current);

  return (
    <div
      data-testid="booking-step-indicator"
      data-step={current}
      className="flex items-center justify-center gap-0 flex-wrap"
    >
      {steps.map((s, i) => {
        const done = i < idx;
        const active = i === idx;
        return (
          <div key={s.key} className="flex items-center">
            <div className="flex items-center gap-1 sm:gap-2 px-1">
              <div
                className={`w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 transition-all ${
                  done
                    ? "bg-[var(--primary)] text-white"
                    : active
                    ? "bg-[var(--primary)] text-white ring-4 ring-[var(--primary)]/20"
                    : "bg-gray-200 text-gray-400"
                }`}
              >
                {done ? <Check size={11} strokeWidth={3} /> : i + 1}
              </div>
              <span className={`hidden sm:inline text-xs sm:text-sm font-medium whitespace-nowrap ${active ? "text-gray-900" : done ? "text-gray-500" : "text-gray-400"}`}>
                {t(s.labelKey)}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className={`w-2 sm:w-6 h-0.5 flex-shrink-0 transition-colors ${done ? "bg-[var(--primary)]" : "bg-gray-200"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <p className="text-red-500 text-xs mt-1 flex items-center gap-1"><AlertCircle size={11} />{msg}</p>;
}

// ── Countdown Timer ───────────────────────────────────────────────────────────

function CountdownTimer({ expiresAt, onExpired }: { expiresAt: Date; onExpired: () => void }) {
  const [remaining, setRemaining] = useState(() => Math.max(0, expiresAt.getTime() - Date.now()));
  const onExpiredRef = useRef(onExpired);
  onExpiredRef.current = onExpired;

  useEffect(() => {
    const tick = () => {
      const diff = Math.max(0, expiresAt.getTime() - Date.now());
      setRemaining(diff);
      if (diff === 0) onExpiredRef.current();
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  const minutes = Math.floor(remaining / 60_000);
  const seconds = Math.floor((remaining % 60_000) / 1000);
  const isUrgent = remaining > 0 && remaining < 2 * 60_000;

  if (remaining === 0) {
    return (
      <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
        <AlertCircle size={15} className="flex-shrink-0" />
        <span className="font-medium">Zeitfenster abgelaufen — bitte wählen Sie erneut einen Termin.</span>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm ${
      isUrgent
        ? "bg-orange-50 border border-orange-200 text-orange-700"
        : "bg-emerald-50 border border-emerald-200 text-emerald-700"
    }`}>
      <Clock size={15} className="flex-shrink-0" />
      <span>
        Slot reserviert — noch{" "}
        <strong>{String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}</strong>{" "}
        Min. verfügbar
      </span>
    </div>
  );
}

// ── Step 1: Vet Selection ─────────────────────────────────────────────────────

function StepVet({
  vets,
  vetAvailability,
  primaryColor: _primaryColor,
  onSelect,
}: {
  vets?: VetOption[];
  vetAvailability?: { id: string; title?: string | null; firstName: string | null; lastName: string | null; hasAvailableSlots: boolean }[];
  primaryColor: string;
  onSelect: (vetId: string) => void;
}) {
  const { t } = useLocale();
  const handleVetClick = (vetId: string) => {
    onSelect(vetId);
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-gray-800 mb-4">{t("booking.selectVet")}</h3>
        <p className="text-sm text-gray-500 mb-6">
          {t("booking.selectVetDescription")}
        </p>
      </div>

      {/* Auto-assign option */}
      <button
        data-testid="booking-vet-auto"
        onClick={() => handleVetClick("")}
        className="w-full p-4 rounded-xl border-2 border-gray-200 hover:border-[var(--primary)] hover:bg-[var(--primary)]/5 text-left transition-all"
      >
        <div className="text-gray-900">{t("booking.autoAssign")}</div>
        <p className="text-sm text-gray-500 mt-1">{t("booking.autoAssignDescription")}</p>
      </button>

      {/* Vet options */}
      {vets && vets.length > 0 && (
        <div className="space-y-3">
          <div className="text-xs text-gray-500 uppercase tracking-wide">{t("booking.availableVets")}</div>
          {vets.map((vet) => {
            // Check if this vet has available slots in the next 14 days
            const availability = vetAvailability?.find((v) => v.id === vet.id);
            const hasAvailableSlots = availability?.hasAvailableSlots ?? true; // Default to true if not loaded yet
            const isDisabled = !hasAvailableSlots;

            return (
              <button
                key={vet.id}
                data-testid="booking-vet-card"
                onClick={() => handleVetClick(vet.id)}
                disabled={isDisabled}
                className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                  isDisabled
                    ? "border-gray-100 bg-gray-50 cursor-not-allowed opacity-50"
                    : "border-gray-200 hover:border-[var(--primary)] hover:bg-[var(--primary)]/5"
                }`}
              >
                <div className="text-gray-900">{formatVetName(vet.title, vet.firstName, vet.lastName)}</div>
                {isDisabled && <p className="text-xs text-gray-400 mt-1">{t("booking.noSlots")}</p>}
              </button>
            );
          })}
        </div>
      )}

      {/* CTA */}
      <p className="text-xs text-gray-400 text-center">
        {t("booking.selectVetHint")}
      </p>
    </div>
  );
}

// ── Step 2: Date + Time ───────────────────────────────────────────────────────

function StepDate({
  tenantId,
  vetId,
  vets,
  primaryColor,
  browserSessionId,
  embeddingOrigin,
  onBack,
  onSelect,
}: {
  tenantId: string;
  vetId: string;
  vets?: VetOption[];
  primaryColor: string;
  browserSessionId: string;
  embeddingOrigin?: string;
  onBack: () => void;
  onSelect: (slot: Slot, holdToken: string, holdExpiresAt: Date) => void;
}) {
  const utils = trpc.useUtils();

  const weekdays = buildWeekdays(14);
  const [page, setPage] = useState(0);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);

  // Clear cached slot data on mount so returning bookers never see stale availability
  useEffect(() => {
    utils.booking.getAvailableSlots.reset();
  }, [utils.booking.getAvailableSlots]);

  // Hold state
  const [holdToken, setHoldToken] = useState<string | null>(null);
  const [holdExpiresAt, setHoldExpiresAt] = useState<Date | null>(null);
  const [holdError, setHoldError] = useState<string | null>(null);

  const visibleDays = weekdays.slice(page * 5, page * 5 + 5);
  const maxPage = Math.ceil(weekdays.length / 5) - 1;

  const { data: slots, isLoading: slotsLoading, refetch: refetchSlots } =
    trpc.booking.getAvailableSlots.useQuery(
      {
        tenantId,
        date: selectedDay!,
        vetId: vetId || undefined,
        embeddingOrigin,
      },
      { enabled: !!selectedDay, staleTime: 0 }
    );

  const holdSlotMutation = trpc.booking.holdSlot.useMutation();
  const releaseHoldMutation = trpc.booking.releaseHold.useMutation();

  const handleDayClick = (d: Date) => {
    setSelectedDay(d);
    setSelectedSlot(null);
    setHoldError(null);
    // Release hold when switching day
    if (holdToken) {
      releaseHoldMutation.mutate({ holdToken, embeddingOrigin });
      setHoldToken(null);
      setHoldExpiresAt(null);
    }
  };

  const handleSlotClick = (slot: Slot) => {
    setHoldError(null);
    // Release previous hold before creating a new one
    if (holdToken) {
      releaseHoldMutation.mutate({ holdToken, embeddingOrigin });
      setHoldToken(null);
      setHoldExpiresAt(null);
    }
    setSelectedSlot(slot);

    holdSlotMutation.mutate(
      {
        tenantId,
        slotDatetime: slot.start,
        vetId: vetId || undefined,
        browserSessionId,
        embeddingOrigin,
      },
      {
        onSuccess: (data) => {
          setHoldToken(data.holdToken);
          setHoldExpiresAt(new Date(data.expiresAt));
        },
        onError: (error) => {
          setSelectedSlot(null);
          setHoldError(error.message || "Dieser Termin ist leider nicht mehr verfügbar.");
          void refetchSlots();
        },
      }
    );
  };

  const handleBack = () => {
    if (holdToken) {
      releaseHoldMutation.mutate({ holdToken, embeddingOrigin });
    }
    onBack();
  };

  const canProceed = !!selectedSlot && !!holdToken && !holdSlotMutation.isPending;

  // Get vet name for display
  const getVetName = () => {
    if (!vetId) return "Automatisch zugewiesen";
    const vet = vets?.find(v => v.id === vetId);
    return vet ? formatVetName(vet.title, vet.firstName, vet.lastName) : "Automatisch zugewiesen";
  };

  return (
    <div className="space-y-6">
      {/* Vet reminder */}
      <div
        className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm border"
        style={{
          backgroundColor: `${primaryColor}15`,
          borderColor: `${primaryColor}40`,
        }}
      >
        <Stethoscope
          size={15}
          className="flex-shrink-0"
          style={{ color: primaryColor }}
        />
        <span
          className="font-medium"
          style={{ color: primaryColor }}
        >
          {getVetName()}
        </span>
      </div>

      {/* Day picker */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-gray-800">Tag auswählen</h3>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30 transition-colors"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-xs text-gray-400 px-1">
              {page + 1} / {maxPage + 1}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(maxPage, p + 1))}
              disabled={page === maxPage}
              className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30 transition-colors"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-5 gap-2">
          {visibleDays.map((d) => {
            const isSelected = !!selectedDay && isSameDay(d, selectedDay);
            return (
              <button
                key={d.toISOString()}
                onClick={() => handleDayClick(d)}
                className={`flex flex-col items-center py-3 px-1 rounded-xl border-2 transition-all text-sm font-medium ${
                  isSelected
                    ? "border-[var(--primary)] bg-[var(--primary)]/5 text-[var(--primary)]"
                    : "border-gray-200 hover:border-gray-300 text-gray-700"
                }`}
              >
                <span className="text-xs text-gray-400 font-normal">
                  {d.toLocaleDateString("de-DE", { weekday: "short" })}
                </span>
                <span className="text-lg font-bold mt-0.5 leading-tight">{d.getDate()}</span>
                <span className="text-xs text-gray-400">
                  {d.toLocaleDateString("de-DE", { month: "short" })}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Time slots */}
      {selectedDay && (
        <div>
          <h3 className="text-gray-800 mb-3">
            Uhrzeit wählen — {fmtDate(selectedDay)}
          </h3>
          {slotsLoading ? (
            <div className="flex items-center justify-center py-8 text-gray-400">
              <Loader2 size={20} className="animate-spin mr-2" />
              Verfügbarkeit wird geladen…
            </div>
          ) : !slots?.length ? (
            <div className="text-center py-8 bg-gray-50 rounded-xl border border-gray-200">
              <Calendar size={28} className="mx-auto text-gray-300 mb-2" />
              <p className="text-gray-500 text-sm font-medium">Keine freien Termine an diesem Tag</p>
              <p className="text-gray-400 text-xs mt-1">Bitte einen anderen Tag wählen</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {slots.map((s) => {
                const slotKey = new Date(s.start).toISOString();
                const isSelected = selectedSlot && new Date(selectedSlot.start).toISOString() === slotKey;
                const isThisLoading = holdSlotMutation.isPending && !!isSelected;
                return (
                  <button
                    key={slotKey}
                    onClick={() => handleSlotClick({ start: new Date(s.start), end: new Date(s.end) })}
                    disabled={holdSlotMutation.isPending && !isSelected}
                    className={`py-2.5 px-3 rounded-xl border-2 text-sm font-semibold transition-all flex items-center justify-center ${
                      isSelected
                        ? "border-[var(--primary)] bg-[var(--primary)] text-white"
                        : "border-gray-200 hover:border-[var(--primary)]/50 text-gray-700 disabled:opacity-50"
                    }`}
                  >
                    {isThisLoading
                      ? <Loader2 size={14} className="animate-spin" />
                      : fmtTime(new Date(s.start))}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Hold error */}
      {holdError && (
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-700">
          <AlertCircle size={15} className="flex-shrink-0" />
          <span>{holdError}</span>
        </div>
      )}

      {/* CTA */}
      <div className="flex gap-3 pt-2">
        <button
          onClick={handleBack}
          className="flex items-center gap-1.5 px-4 py-3 rounded-xl border border-gray-300 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
        >
          <ChevronLeft size={15} /> Zurück
        </button>
        <button
          onClick={() => {
            if (selectedSlot && holdToken && holdExpiresAt) {
              onSelect(selectedSlot, holdToken, holdExpiresAt);
            }
          }}
          disabled={!canProceed}
          className="flex-1 py-3.5 rounded-xl font-semibold text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed text-white flex items-center justify-center gap-2"
          style={{ backgroundColor: primaryColor }}
        >
          {holdSlotMutation.isPending ? (
            <><Loader2 size={15} className="animate-spin" /> Wird reserviert…</>
          ) : (
            "Weiter zu den Angaben →"
          )}
        </button>
      </div>
    </div>
  );
}

// ── Step 2: Patient + Owner Details ──────────────────────────────────────────

function StepDetails({
  slot,
  vetName,
  primaryColor,
  holdToken: _holdToken,
  holdExpiresAt,
  onHoldExpired,
  onBack,
  onNext,
  initialPatient,
  initialOwner,
  t,
}: {
  slot: Slot;
  vetName?: string;
  primaryColor: string;
  holdToken?: string | null;
  holdExpiresAt?: Date | null;
  onHoldExpired?: () => void;
  onBack: () => void;
  onNext: (patient: PatientForm, owner: OwnerForm) => void;
  initialPatient?: PatientForm | null;
  initialOwner?: OwnerForm | null;
  t: (key: string) => string;
}) {
  const [patient, setPatient] = useState<PatientForm>(initialPatient ?? { name: "", species: "Hund", breed: "", reason: "" });
  const [owner, setOwner] = useState<OwnerForm>(initialOwner ?? { firstName: "", lastName: "", email: "", phone: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const setP = (f: keyof PatientForm, v: string) => {
    setPatient((p) => ({ ...p, [f]: v }));
    setErrors((e) => ({ ...e, [f]: "" }));
  };
  const setO = (f: keyof OwnerForm, v: string) => {
    setOwner((p) => ({ ...p, [f]: v }));
    setErrors((e) => ({ ...e, [f]: "" }));
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!patient.name.trim()) e.name = t("booking.errors.petName");
    if (!patient.reason.trim()) e.reason = t("booking.errors.reason");
    if (!owner.firstName.trim()) e.firstName = t("booking.errors.firstName");
    if (!owner.lastName.trim()) e.lastName = t("booking.errors.lastName");
    if (!owner.email.trim()) e.email = t("booking.errors.email");
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(owner.email)) e.email = t("booking.errors.emailInvalid");
    if (!owner.phone.trim()) e.phone = t("booking.errors.phone");
    return e;
  };

  const handleSubmit = () => {
    const e = validate();
    if (Object.keys(e).length > 0) { setErrors(e); return; }
    onNext(patient, owner);
  };

  const inputClass = "w-full rounded-xl border border-gray-300 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/40 focus:border-[var(--primary)] transition placeholder:text-gray-400";

  return (
    <div className="space-y-6">
      {/* Selected slot reminder */}
      <div className="flex items-center gap-2 bg-[var(--primary)]/5 border border-[var(--primary)]/20 rounded-xl px-4 py-3 text-sm">
        <Clock size={15} className="text-[var(--primary)] flex-shrink-0" />
        <div className="text-gray-700">
          <div><strong>{fmtLong(slot.start)}</strong>, {fmtTime(slot.start)} – {fmtTime(slot.end)} Uhr</div>
          {vetName && <div className="text-xs text-gray-600 mt-0.5">{vetName}</div>}
        </div>
      </div>

      {/* Countdown timer — slot is reserved */}
      {holdExpiresAt && onHoldExpired && (
        <CountdownTimer expiresAt={holdExpiresAt} onExpired={onHoldExpired} />
      )}

      {/* Patient section */}
      <div className="space-y-4">
        <h3 className="text-gray-800 text-sm uppercase">{t("booking.patient")}</h3>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            {t("booking.petName")} <span className="text-red-500">*</span>
          </label>
          <input
            className={inputClass}
            placeholder={t("booking.petNamePlaceholder")}
            value={patient.name}
            onChange={(e) => setP("name", e.target.value)}
          />
          <FieldError msg={errors.name} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">{t("booking.species")} <span className="text-red-500">*</span></label>
            <select
              className={inputClass + " bg-white"}
              value={patient.species}
              onChange={(e) => setP("species", e.target.value)}
            >
              {SPECIES_OPTIONS.map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">{t("booking.breed")}</label>
            <input
              className={inputClass}
              placeholder={t("booking.breedPlaceholder")}
              value={patient.breed}
              onChange={(e) => setP("breed", e.target.value)}
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            {t("booking.reason")} <span className="text-red-500">*</span>
          </label>
          <input
            className={inputClass}
            placeholder={t("booking.reasonPlaceholder")}
            value={patient.reason}
            onChange={(e) => setP("reason", e.target.value)}
          />
          <FieldError msg={errors.reason} />
        </div>
      </div>

      {/* Owner section */}
      <div className="space-y-4 pt-2 border-t border-gray-100">
        <h3 className="text-gray-800 text-sm uppercase pt-2">{t("booking.owner")}</h3>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">{t("booking.firstName")} <span className="text-red-500">*</span></label>
            <input className={inputClass} placeholder="Max" value={owner.firstName} onChange={(e) => setO("firstName", e.target.value)} />
            <FieldError msg={errors.firstName} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">{t("booking.lastName")} <span className="text-red-500">*</span></label>
            <input className={inputClass} placeholder="Mustermann" value={owner.lastName} onChange={(e) => setO("lastName", e.target.value)} />
            <FieldError msg={errors.lastName} />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">{t("booking.email")} <span className="text-red-500">*</span></label>
          <input
            type="email"
            className={inputClass}
            placeholder={t("booking.emailPlaceholder")}
            value={owner.email}
            onChange={(e) => setO("email", e.target.value)}
          />
          <FieldError msg={errors.email} />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">{t("booking.phone")} <span className="text-red-500">*</span></label>
          <input
            type="tel"
            className={inputClass}
            placeholder={t("booking.phonePlaceholder")}
            value={owner.phone}
            onChange={(e) => setO("phone", e.target.value)}
          />
          <FieldError msg={errors.phone} />
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 px-4 py-3 rounded-xl border border-gray-300 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
        >
          <ChevronLeft size={15} /> {t("booking.buttons.back")}
        </button>
        <button
          onClick={handleSubmit}
          className="flex-1 py-3 rounded-xl font-semibold text-sm text-white transition-all"
          style={{ backgroundColor: primaryColor }}
        >
          {t("booking.buttons.next")} →
        </button>
      </div>
    </div>
  );
}

// ── Step 3: Confirm ───────────────────────────────────────────────────────────

function StepConfirm({
  slot,
  patient,
  owner,
  tenantId,
  vets,
  selectedVetId,
  primaryColor,
  browserSessionId,
  embeddingOrigin,
  holdToken: _holdToken,
  holdExpiresAt,
  onHoldExpired,
  onBack,
  onSuccess,
}: {
  slot: Slot;
  patient: PatientForm;
  owner: OwnerForm;
  tenantId: string;
  vets?: VetOption[];
  selectedVetId?: string;
  primaryColor: string;
  browserSessionId: string;
  embeddingOrigin?: string;
  holdToken?: string | null;
  holdExpiresAt?: Date | null;
  onHoldExpired?: () => void;
  onBack: () => void;
  onSuccess: (result: { startTime: Date; ownerName: string; patientName: string; vetName?: string }) => void;
}) {
  // Find vet name from selected or suggested vet
  const getVetName = () => {
    if (selectedVetId && vets) {
      const vet = vets.find((v) => v.id === selectedVetId);
      return vet ? formatVetName(vet.title, vet.firstName, vet.lastName) : undefined;
    }
    return undefined;
  };

  const bookMutation = trpc.booking.book.useMutation({
    onSuccess: (data) => {
      onSuccess({
        startTime: new Date(data.startTime),
        ownerName: data.ownerName,
        patientName: data.patientName,
        vetName: getVetName(),
      });
    },
  });

  const handleSubmit = () => {
    bookMutation.mutate({
      tenantId,
      slotStart: slot.start,
      slotEnd: slot.end,
      reason: patient.reason,
      patient: {
        name: patient.name,
        species: patient.species,
        breed: patient.breed || undefined,
      },
      owner: {
        firstName: owner.firstName,
        lastName: owner.lastName,
        email: owner.email,
        phone: owner.phone,
      },
      vetId: selectedVetId || undefined,
      browserSessionId,
      embeddingOrigin,
    });
  };

  const rows: [string, string][] = [
    ["Termin", `${fmtLong(slot.start)}, ${fmtTime(slot.start)} – ${fmtTime(slot.end)} Uhr`],
    ["Tierarzt", selectedVetId && vets ? (getVetName() || "–") : "Automatisch zugewiesen"],
    ["Tier", `${patient.name} (${patient.species}${patient.breed ? `, ${patient.breed}` : ""})`],
    ["Grund", patient.reason],
    ["Besitzer", `${owner.firstName} ${owner.lastName}`],
    ["E-Mail", owner.email],
    ["Telefon", owner.phone],
  ];

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-gray-800 mb-1">Ihre Angaben im Überblick</h3>
        <p className="text-sm text-gray-500">Bitte prüfen Sie alles und bestätigen Sie den Termin.</p>
      </div>

      {/* Countdown timer — slot is reserved */}
      {holdExpiresAt && onHoldExpired && (
        <CountdownTimer expiresAt={holdExpiresAt} onExpired={onHoldExpired} />
      )}

      <div className="bg-gray-50 rounded-2xl border border-gray-200 overflow-hidden">
        {rows.map(([label, value]) => (
          <div key={label} className="flex px-5 py-3.5 border-b border-gray-100 last:border-0">
            <span className="text-sm text-gray-500 w-28 flex-shrink-0 font-medium">{label}</span>
            <span className="text-sm text-gray-900 font-medium">{value}</span>
          </div>
        ))}
      </div>

      {bookMutation.error && (
        <div className="flex items-center gap-2.5 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">
          <AlertCircle size={16} className="flex-shrink-0" />
          {bookMutation.error.message}
        </div>
      )}

      <div className="flex gap-3">
        <button
          onClick={onBack}
          disabled={bookMutation.isPending}
          className="flex items-center gap-1.5 px-4 py-3 rounded-xl border border-gray-300 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-40"
        >
          <ChevronLeft size={15} /> Zurück
        </button>
        <button
          onClick={handleSubmit}
          disabled={bookMutation.isPending}
          className="flex-1 py-3 rounded-xl font-semibold text-sm text-white transition-all flex items-center justify-center gap-2 disabled:opacity-70"
          style={{ backgroundColor: primaryColor }}
        >
          {bookMutation.isPending ? (
            <><Loader2 size={16} className="animate-spin" /> Wird gebucht…</>
          ) : (
            <><Check size={16} /> Termin verbindlich anfragen</>
          )}
        </button>
      </div>

      <p className="text-xs text-gray-400 text-center">
        Mit der Anfrage stimmen Sie der Verarbeitung Ihrer Daten gemäß Datenschutzerklärung zu.
      </p>
    </div>
  );
}

// ── Success Screen ─────────────────────────────────────────────────────────────

function SuccessScreen({
  startTime,
  ownerName,
  patientName,
  vetName,
  clinicName,
  primaryColor,
  onNewBooking,
}: {
  startTime: Date;
  ownerName: string;
  patientName: string;
  vetName?: string;
  clinicName: string;
  primaryColor: string;
  onNewBooking: () => void;
}) {
  return (
    <div className="text-center py-4 space-y-5">
      <div
        className="w-16 h-16 rounded-full flex items-center justify-center mx-auto"
        style={{ backgroundColor: `${primaryColor}20` }}
      >
        <Check size={28} style={{ color: primaryColor }} strokeWidth={2.5} />
      </div>
      <div>
        <h2 className="text-xl text-gray-900">Fast geschafft!</h2>
        <p className="text-gray-500 mt-1.5 text-sm">
          Vielen Dank, {ownerName.split(" ")[0]}. Ihre Anfrage für {patientName} wurde erfolgreich übermittelt.
        </p>
      </div>
      <div className="bg-gray-50 rounded-2xl border border-gray-200 p-5 text-left space-y-3">
        <div className="flex items-center gap-3 text-sm">
          <Calendar size={16} style={{ color: primaryColor }} className="flex-shrink-0" />
          <span className="font-semibold text-gray-900">
            {fmtLong(startTime)}, {fmtTime(startTime)} Uhr
          </span>
        </div>
        {vetName && (
          <div className="flex items-center gap-3 text-sm">
            <Stethoscope size={16} className="text-gray-400 flex-shrink-0" />
            <span className="text-gray-600">{vetName}</span>
          </div>
        )}
        <div className="flex items-center gap-3 text-sm">
          <Mail size={16} className="text-gray-400 flex-shrink-0" />
          <span className="text-gray-600">Bitte bestätigen Sie Ihre E-Mail-Adresse, um die Buchung abzuschließen.</span>
        </div>
      </div>
      <p className="text-xs text-gray-400">
        Wir haben eine E-Mail an Ihre Adresse gesendet. Bitte klicken Sie auf den Bestätigungslink — danach prüft {clinicName} Ihre Anfrage und bestätigt den Termin.
      </p>
      <button
        onClick={onNewBooking}
        className="w-full py-3 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90"
        style={{ backgroundColor: primaryColor }}
      >
        Neue Buchung
      </button>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function BookingClient({
  tenantSlug,
  previewToken,
}: {
  tenantSlug: string;
  previewToken?: string;
}) {
  const { t } = useLocale();
  const autoSuggestAttemptedRef = useRef<string | null>(null);
  const embeddingOrigin = getEmbeddingOrigin();
  const poweredByLabel = getProviderUrl();

  const { data: clinic, isLoading: clinicLoading, error: clinicError } =
    trpc.booking.getClinic.useQuery(
      { slug: tenantSlug, embeddingOrigin, previewToken },
      { retry: false }
    );

  // Extract theme settings from tenant
  const primaryColor = clinic
    ? COLOR_PRESETS[(clinic.themePreference as ColorPresetKey) || "sage"].accent
    : "oklch(55% 0.11 240)"; // Fallback to klinikblau

  const typography = clinic
    ? TYPE_PAIRINGS[(clinic.typographyPreference as TypographyPairingKey) || "modern"]
    : TYPE_PAIRINGS.modern;

  const { data: vets } = trpc.booking.listPublicVets.useQuery(
    { tenantId: clinic?.id || "", embeddingOrigin },
    { enabled: !!clinic?.id, retry: false }
  );

  const { data: vetAvailability } = trpc.booking.getVetAvailability.useQuery(
    { tenantId: clinic?.id || "", embeddingOrigin },
    { enabled: !!clinic?.id }
  );

  const suggestVetMutation = trpc.booking.suggestPublicVet.useMutation();
  const releaseHoldMutation = trpc.booking.releaseHold.useMutation();

  // Persistent form state via localStorage
  const { state: formState, updateField, clear: clearFormState } = useBookingFormState(tenantSlug);

  const [step, setStep] = useState<Step>("vet");
  const [successData, setSuccessData] = useState<{ startTime: Date; ownerName: string; patientName: string; vetName?: string } | null>(null);

  // Track booking funnel entry
  const hasTrackedEntry = useRef(false);
  useEffect(() => {
    if (clinic?.id && !hasTrackedEntry.current) {
      hasTrackedEntry.current = true;
      trackEvent(AnalyticsEvents.BOOKING_STARTED, { tenant_slug: tenantSlug });
    }
  }, [clinic?.id, tenantSlug]);

  // 15-min slot hold state
  const [holdToken, setHoldToken] = useState<string | null>(null);
  const [holdExpiresAt, setHoldExpiresAt] = useState<Date | null>(null);

  // Derive state from formState
  const selectedVetId = formState.vetId || "";
  const slot = formState.date
    ? (() => {
        const parsed = JSON.parse(formState.date) as { start: string; end: string };
        return {
          start: new Date(parsed.start),
          end: new Date(parsed.end),
        };
      })()
    : null;
  const patient = formState.patient || null;
  const owner = formState.owner || null;

  /** Called when hold expires in StepDetails or StepConfirm */
  const handleHoldExpired = useCallback(() => {
    setHoldToken(null);
    setHoldExpiresAt(null);
    updateField("date", undefined);
    setStep("date");
  }, [updateField]);

  /** Called when navigating back from StepDetails → StepDate */
  const handleDetailsBack = useCallback(() => {
    if (holdToken) {
      releaseHoldMutation.mutate({ holdToken, embeddingOrigin });
    }
    setHoldToken(null);
    setHoldExpiresAt(null);
    updateField("date", undefined);
    setStep("date");
  }, [holdToken, releaseHoldMutation, updateField, embeddingOrigin]);

  // Helper: Get vet display name by ID
  const getVetDisplayName = (vetId: string) => {
    if (!vetId || !vets) return "Automatisch zugewiesen";
    const vet = vets.find((v) => v.id === vetId);
    return vet ? formatVetName(vet.title, vet.firstName, vet.lastName) : "Automatisch zugewiesen";
  };

  // Auto-select if only one vet is available
  useEffect(() => {
    if (step === "vet" && vets && vets.length === 1 && !selectedVetId) {
      updateField("vetId", vets[0].id);
      setStep("date");
    }
  }, [vets, step, selectedVetId, updateField]);

  // Auto-suggest vet if "Automatisch zuweisen" (empty selectedVetId) and moving to date step
  useEffect(() => {
    if (step !== "date") {
      autoSuggestAttemptedRef.current = null;
      return;
    }

    if (step === "date" && !selectedVetId && clinic?.id && !suggestVetMutation.isPending) {
      if (autoSuggestAttemptedRef.current === clinic.id) return;
      autoSuggestAttemptedRef.current = clinic.id;

      suggestVetMutation.mutate(
        { tenantId: clinic.id, embeddingOrigin },
        {
          onSuccess: (data) => {
            if (data?.id) {
              updateField("vetId", data.id);
            }
          },
          onError: (error) => {
            console.error("Fehler bei Tierarzt-Vorschlag:", error.message);
            // Fallback: Pick first available vet
            if (vets && vets.length > 0) {
              updateField("vetId", vets[0].id);
            }
          },
        }
      );
    }
  }, [step, selectedVetId, clinic?.id, vets, updateField, suggestVetMutation, embeddingOrigin]);

  // Loading state
  if (clinicLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 size={28} className="animate-spin text-gray-400" />
      </div>
    );
  }

  // Not found (shouldn't normally reach here — server gate handles it)
  if (clinicError || !clinic) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="text-center">
          <div className="mb-4 flex justify-center">
            <PawPrint size={64} className="text-gray-400" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">{t("booking.notFound")}</h1>
          <p className="text-gray-500 text-sm">
            {t("booking.notFoundDescription")}
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Inject CSS variables for theme */}
      <style>{`
        :root {
          --primary: ${primaryColor};
          --heading-font: ${typography.heading};
          --body-font: ${typography.body};
          --heading-weight: ${typography.headingWeight};
          --heading-tracking: ${typography.headingTracking};
        }
        * {
          font-family: var(--body-font);
        }
        h1, h2, h3, h4, h5, h6, [role="heading"] {
          font-family: var(--heading-font);
          font-weight: var(--heading-weight);
          letter-spacing: var(--heading-tracking);
        }
      `}</style>

      <div className="min-h-screen bg-gray-50 flex flex-col">
        {/* Clinic header */}
        <div className="sticky top-0 z-50 bg-white border-b border-gray-200 px-6 py-5 shadow-lg" style={{ backgroundColor: '#ffffff', opacity: 1 }}>
          <div className="max-w-xl mx-auto flex items-start gap-4">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center text-white font-bold text-lg flex-shrink-0"
              style={{ backgroundColor: primaryColor }}
            >
              {clinic.monogram || clinic.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="font-bold text-gray-900 text-lg leading-tight">{clinic.name}</h1>
              {clinic.tagline && <p className="text-sm text-gray-600 leading-tight mt-0.5">{clinic.tagline}</p>}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2">
                {(clinic.city || clinic.address) && (
                  <span className="flex items-center gap-1 text-xs text-gray-500">
                    <MapPin size={11} />
                    {clinic.address ? `${clinic.address}, ` : ""}{clinic.postalCode ? `${clinic.postalCode} ` : ""}{clinic.city ?? ""}
                  </span>
                )}
                {clinic.phone && (
                  <a href={`tel:${clinic.phone}`} className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700">
                    <Phone size={11} /> {clinic.phone}
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Booking card */}
        <div className="flex-1 flex items-start justify-center p-4 sm:p-8">
          <div data-testid="booking-page" className="w-full max-w-xl bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            {step !== "success" && (
              <div className="px-6 py-5 border-b border-gray-100">
                <h2 className="text-gray-900 mb-4">{t("booking.title")}</h2>
                <StepIndicator current={step} />
              </div>
            )}

            <div className="px-6 py-6">
              {step === "vet" && (
                <StepVet
                  vets={vets}
                  vetAvailability={vetAvailability}
                  primaryColor={primaryColor}
                  onSelect={(vetId) => { updateField("vetId", vetId); trackEvent(AnalyticsEvents.BOOKING_VET_SELECTED, { vet_id: vetId || "auto", tenant_slug: tenantSlug }); setStep("date"); }}
                />
              )}
              {step === "date" && (
                <StepDate
                  tenantId={clinic.id}
                  vetId={selectedVetId}
                  vets={vets}
                  primaryColor={primaryColor}
                  browserSessionId={formState.browserSessionId!}
                  embeddingOrigin={embeddingOrigin}
                  onBack={() => setStep("vet")}
                  onSelect={(s, token, expiresAt) => {
                    updateField("date", JSON.stringify(s));
                    setHoldToken(token);
                    setHoldExpiresAt(expiresAt);
                    trackEvent(AnalyticsEvents.BOOKING_SLOT_SELECTED, { tenant_slug: tenantSlug });
                    setStep("details");
                  }}
                />
              )}
              {step === "details" && slot && (
                <StepDetails
                  slot={slot}
                  vetName={getVetDisplayName(selectedVetId)}
                  primaryColor={primaryColor}
                  holdToken={holdToken}
                  holdExpiresAt={holdExpiresAt}
                  onHoldExpired={handleHoldExpired}
                  onBack={handleDetailsBack}
                  onNext={(p, o) => { updateField("patient", p); updateField("owner", o); trackEvent(AnalyticsEvents.BOOKING_DETAILS_ENTERED, { species: p.species, tenant_slug: tenantSlug }); setStep("confirm"); }}
                  initialPatient={patient}
                  initialOwner={owner}
                  t={t}
                />
              )}
              {step === "confirm" && slot && patient && owner && (
                <StepConfirm
                  slot={slot}
                  patient={patient}
                  owner={owner}
                  tenantId={clinic.id}
                  vets={vets}
                  selectedVetId={selectedVetId}
                  primaryColor={primaryColor}
                  browserSessionId={formState.browserSessionId!}
                  embeddingOrigin={embeddingOrigin}
                  holdToken={holdToken}
                  holdExpiresAt={holdExpiresAt}
                  onHoldExpired={handleHoldExpired}
                  onBack={() => setStep("details")}
                  onSuccess={(data) => { clearFormState(); setSuccessData(data); trackEvent(AnalyticsEvents.BOOKING_CONFIRMED, { tenant_slug: tenantSlug, source: "online_booking" }); setStep("success"); }}
                />
              )}
              {step === "success" && successData && (
                <SuccessScreen
                  startTime={successData.startTime}
                  ownerName={successData.ownerName}
                  patientName={successData.patientName}
                  vetName={successData.vetName}
                  clinicName={clinic.name}
                  primaryColor={primaryColor}
                  onNewBooking={() => { setSuccessData(null); setHoldToken(null); setHoldExpiresAt(null); clearFormState(); setStep("vet"); }}
                />
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-center gap-1.5">
              <span className="text-xs text-gray-400">Powered by</span>
              <a
                href={poweredByLabel}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-bold text-gray-500 hover:text-gray-700 underline underline-offset-2"
              >
                {poweredByLabel}
              </a>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
