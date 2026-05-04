import { and, eq, gte, lte } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { appointments, vaccinations } from "@/lib/db/schema";

export async function correlateReminderToAppointment(input: {
  vaccinationId: string;
  reminderSentAt: Date;
  lookbackWindowDays?: number;
}) {
  const lookbackWindowDays = input.lookbackWindowDays ?? 14;

  const [vaccination] = await db
    .select({
      id: vaccinations.id,
      tenantId: vaccinations.tenantId,
      patientId: vaccinations.patientId,
    })
    .from(vaccinations)
    .where(eq(vaccinations.id, input.vaccinationId))
    .limit(1);

  if (!vaccination) {
    return { appointmentId: null as string | null, daysToAppointment: null as number | null };
  }

  const until = new Date(
    input.reminderSentAt.getTime() + lookbackWindowDays * 24 * 60 * 60 * 1000
  );

  const [appointment] = await db
    .select({ id: appointments.id, startTime: appointments.startTime })
    .from(appointments)
    .where(
      and(
        eq(appointments.tenantId, vaccination.tenantId),
        eq(appointments.patientId, vaccination.patientId),
        gte(appointments.startTime, input.reminderSentAt),
        lte(appointments.startTime, until)
      )
    )
    .limit(1);

  if (!appointment) {
    return { appointmentId: null as string | null, daysToAppointment: null as number | null };
  }

  return {
    appointmentId: appointment.id,
    daysToAppointment: Math.ceil(
      (appointment.startTime.getTime() - input.reminderSentAt.getTime()) / (24 * 60 * 60 * 1000)
    ),
  };
}
