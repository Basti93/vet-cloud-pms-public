export type TimeRange = {
  startHour: number; // 0–23
  startMin: number;  // 0 or 30
  endHour: number;
  endMin: number;
};

/** One entry per day of week (0=Sun…6=Sat). Empty slots array = closed. */
export type DaySchedule = {
  dayOfWeek: number;
  slots: TimeRange[];
};

export const DEFAULT_OPENING_HOURS: DaySchedule[] = [
  { dayOfWeek: 0, slots: [] },
  { dayOfWeek: 1, slots: [{ startHour: 8, startMin: 0, endHour: 18, endMin: 0 }] },
  { dayOfWeek: 2, slots: [{ startHour: 8, startMin: 0, endHour: 18, endMin: 0 }] },
  { dayOfWeek: 3, slots: [{ startHour: 8, startMin: 0, endHour: 18, endMin: 0 }] },
  { dayOfWeek: 4, slots: [{ startHour: 8, startMin: 0, endHour: 18, endMin: 0 }] },
  { dayOfWeek: 5, slots: [{ startHour: 8, startMin: 0, endHour: 18, endMin: 0 }] },
  { dayOfWeek: 6, slots: [] },
];

/** Format a time range as "09:00–11:30" */
export function formatTimeRange(r: TimeRange): string {
  const fmt = (h: number, m: number) =>
    `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  return `${fmt(r.startHour, r.startMin)}–${fmt(r.endHour, r.endMin)}`;
}

const DAY_ABBR = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

/**
 * Convert DaySchedule[] to display-ready { day, time } rows for website templates.
 * Groups consecutive open days with identical slot patterns.
 */
export function openingHoursToDisplayRows(
  hours: DaySchedule[]
): Array<{ day: string; time: string }> {
  const ordered = [1, 2, 3, 4, 5, 6, 0].map((d) => hours.find((h) => h.dayOfWeek === d) ?? { dayOfWeek: d, slots: [] });

  const rows: Array<{ day: string; time: string }> = [];
  let i = 0;

  while (i < ordered.length) {
    const current = ordered[i];
    const timeStr = current.slots.length === 0
      ? 'Geschlossen'
      : current.slots.map(formatTimeRange).join(', ');

    // Find run of consecutive days with the same time string
    let j = i + 1;
    while (j < ordered.length) {
      const nextTime = ordered[j].slots.length === 0
        ? 'Geschlossen'
        : ordered[j].slots.map(formatTimeRange).join(', ');
      if (nextTime !== timeStr) break;
      j++;
    }

    const dayLabel = j - i === 1
      ? DAY_ABBR[current.dayOfWeek]
      : `${DAY_ABBR[current.dayOfWeek]}–${DAY_ABBR[ordered[j - 1].dayOfWeek]}`;

    rows.push({ day: dayLabel, time: timeStr });
    i = j;
  }

  return rows;
}

/**
 * Convert DaySchedule[] to FullCalendar businessHours format.
 * Returns an array of { daysOfWeek, startTime, endTime } objects.
 */
export function toFullCalendarBusinessHours(
  hours: DaySchedule[]
): Array<{ daysOfWeek: number[]; startTime: string; endTime: string }> {
  const result: Array<{ daysOfWeek: number[]; startTime: string; endTime: string }> = [];

  for (const day of hours) {
    for (const slot of day.slots) {
      const startTime = `${String(slot.startHour).padStart(2, '0')}:${String(slot.startMin).padStart(2, '0')}`;
      const endTime = `${String(slot.endHour).padStart(2, '0')}:${String(slot.endMin).padStart(2, '0')}`;

      // Try to merge with existing entry with same times
      const existing = result.find((r) => r.startTime === startTime && r.endTime === endTime);
      if (existing) {
        existing.daysOfWeek.push(day.dayOfWeek);
      } else {
        result.push({ daysOfWeek: [day.dayOfWeek], startTime, endTime });
      }
    }
  }

  return result;
}
