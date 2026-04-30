"use client";

// Time options at 15-min increments (06:00 through 22:00)
const TIME_OPTIONS = Array.from({ length: 65 }, (_, i) => {
  const totalMin = 6 * 60 + i * 15; // Start at 06:00
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return {
    h,
    m,
    label: `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`,
  };
}).filter((t) => t.h <= 22); // Ensure we don't exceed 22:00

interface TimeSelectProps {
  hour: number;
  min: number;
  onChange: (h: number, m: number) => void;
  label?: string;
}

export function TimeSelect({ hour, min, onChange, label }: TimeSelectProps) {
  const value = `${hour}:${min}`;

  return (
    <div>
      {label && (
        <label className="text-xs block mb-1" style={{ color: "var(--color-muted)" }}>
          {label}
        </label>
      )}
      <select
        value={value}
        onChange={(e) => {
          const [h, m] = e.target.value.split(":").map(Number);
          onChange(h, m);
        }}
        className="text-sm border rounded px-2 py-1"
        style={{
          backgroundColor: "var(--color-surface)",
          borderColor: "var(--color-border)",
          color: "var(--color-fg)",
        }}
      >
        {TIME_OPTIONS.map((t) => (
          <option key={t.label} value={`${t.h}:${t.m}`}>
            {t.label}
          </option>
        ))}
      </select>
    </div>
  );
}
