"use client";

import { Plus, X } from "lucide-react";
import { TimeSelect } from "./TimeSelect";

export interface TimeRange {
  startHour: number;
  startMin: number;
  endHour: number;
  endMin: number;
}

export interface DaySchedule {
  dayOfWeek: number;
  slots: TimeRange[];
}

const DAY_SHORT = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];

interface DayRowProps {
  day: DaySchedule;
  onChange: (updated: DaySchedule) => void;
  disabled?: boolean;
}

export function DayRow({ day, onChange, disabled }: DayRowProps) {
  const isOpen = day.slots.length > 0;

  function toggleOpen() {
    if (isOpen) {
      onChange({ ...day, slots: [] });
    } else {
      onChange({ ...day, slots: [{ startHour: 8, startMin: 0, endHour: 18, endMin: 0 }] });
    }
  }

  function setSlotTime(
    i: number,
    which: "start" | "end",
    h: number,
    m: number
  ) {
    onChange({
      ...day,
      slots: day.slots.map((s, idx) =>
        idx !== i
          ? s
          : which === "start"
          ? { ...s, startHour: h, startMin: m }
          : { ...s, endHour: h, endMin: m }
      ),
    });
  }

  function addSlot() {
    const last = day.slots[day.slots.length - 1];
    const newStart = last ? last.endHour * 60 + last.endMin + 60 : 8 * 60;
    const h = Math.min(Math.floor(newStart / 60), 22);
    const m = newStart % 60 === 0 ? 0 : 30;
    onChange({
      ...day,
      slots: [
        ...day.slots,
        { startHour: h, startMin: m, endHour: h + 2, endMin: m },
      ],
    });
  }

  function removeSlot(i: number) {
    onChange({ ...day, slots: day.slots.filter((_, idx) => idx !== i) });
  }

  return (
    <div className="flex items-start gap-3 py-2">
      <span
        className="w-8 text-sm font-medium pt-1.5"
        style={{ color: "var(--color-fg)" }}
      >
        {DAY_SHORT[day.dayOfWeek]}
      </span>

      {/* Toggle */}
      <button
        onClick={toggleOpen}
        disabled={disabled}
        className="relative inline-flex h-5 w-9 items-center rounded-full transition-colors flex-shrink-0 mt-1.5 disabled:opacity-50"
        style={{
          backgroundColor: isOpen ? "var(--color-accent)" : "var(--color-border)",
          cursor: disabled ? "not-allowed" : "pointer",
        }}
      >
        <span
          className="inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform"
          style={{ transform: isOpen ? "translateX(18px)" : "translateX(2px)" }}
        />
      </button>

      {!isOpen ? (
        <span className="text-sm pt-1" style={{ color: "var(--color-muted)" }}>
          Geschlossen
        </span>
      ) : (
        <div className="flex flex-col gap-1.5 flex-1">
          {day.slots.map((slot, i) => (
            <div key={i} className="flex items-center gap-2">
              <TimeSelect
                hour={slot.startHour}
                min={slot.startMin}
                onChange={(h, m) => setSlotTime(i, "start", h, m)}
              />
              <span
                className="text-sm"
                style={{ color: "var(--color-muted)" }}
              >
                –
              </span>
              <TimeSelect
                hour={slot.endHour}
                min={slot.endMin}
                onChange={(h, m) => setSlotTime(i, "end", h, m)}
              />
              {day.slots.length > 1 && (
                <button
                  onClick={() => removeSlot(i)}
                  disabled={disabled}
                  className="p-0.5 hover:opacity-70 disabled:opacity-50"
                  style={{ color: "var(--color-muted)" }}
                >
                  <X size={14} />
                </button>
              )}
            </div>
          ))}
          <button
            onClick={addSlot}
            disabled={disabled}
            className="flex items-center gap-1 text-xs mt-0.5 hover:opacity-70 disabled:opacity-50"
            style={{ color: "var(--color-accent)" }}
          >
            <Plus size={12} /> Zeitraum hinzufügen
          </button>
        </div>
      )}
    </div>
  );
}
