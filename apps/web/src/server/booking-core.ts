import type { TimeRange } from "@/lib/schedule-types";

export interface BookingSlot {
  start: Date;
  end: Date;
}

export interface AppointmentInterval {
  startTime: Date | string;
  endTime: Date | string;
}

export interface SlotHold {
  slotDatetime: Date | string;
}

/**
 * Convert a local date+time in a given IANA timezone to a UTC Date.
 * Uses Intl and correctly handles DST without adding another dependency.
 */
export function zonedToUtc(localDateStr: string, hour: number, min: number, timezone: string): Date {
  const pad = (n: number) => String(n).padStart(2, "0");
  const pseudo = new Date(`${localDateStr}T${pad(hour)}:${pad(min)}:00Z`);
  const inTz = new Date(
    pseudo.toLocaleString("sv", { timeZone: timezone }).replace(" ", "T") + "Z"
  );
  return new Date(pseudo.getTime() + (pseudo.getTime() - inTz.getTime()));
}

export function generateSlotsFromRanges(
  localDateStr: string,
  ranges: TimeRange[],
  timezone: string,
  slotDurationMin = 30,
  now = new Date()
): BookingSlot[] {
  const slots: BookingSlot[] = [];

  for (const range of ranges) {
    let totalMin = range.startHour * 60 + range.startMin;
    const endTotalMin = range.endHour * 60 + range.endMin;

    while (totalMin + slotDurationMin <= endTotalMin) {
      const start = zonedToUtc(localDateStr, Math.floor(totalMin / 60), totalMin % 60, timezone);
      const end = new Date(start.getTime() + slotDurationMin * 60_000);
      if (start > now) slots.push({ start, end });
      totalMin += slotDurationMin;
    }
  }

  return slots;
}

export function intervalsOverlap(slot: BookingSlot, interval: AppointmentInterval) {
  return new Date(interval.startTime) < slot.end && new Date(interval.endTime) > slot.start;
}

export function filterAvailableSlots(
  slots: BookingSlot[],
  booked: AppointmentInterval[],
  holds: SlotHold[]
) {
  return slots.filter(
    (slot) =>
      !booked.some((appointment) => intervalsOverlap(slot, appointment)) &&
      !holds.some((hold) => new Date(hold.slotDatetime).getTime() === slot.start.getTime())
  );
}

export function selectVetByFairDistribution(
  vets: Array<{ id: string; appointmentCount: number }>
): string {
  if (vets.length === 0) {
    throw new Error("No vets available for assignment");
  }

  return [...vets].sort((a, b) => a.appointmentCount - b.appointmentCount)[0].id;
}
