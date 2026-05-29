import { z } from "zod";
import { eq, and, gte, lte, count, asc, sql } from "drizzle-orm";
import { createTRPCRouter, protectedProcedure } from "@/server/trpc";
import {
  appointments,
  patients,
  users,
  emailLogs,
} from "@/lib/db/schema";

export const statisticsRouter = createTRPCRouter({
  getMetrics: protectedProcedure
    .input(
      z.object({
        tenantId: z.string().uuid(),
        from: z.date(),
        to: z.date(),
        vetId: z.string().uuid().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const conditions = [
        eq(appointments.tenantId, input.tenantId),
        gte(appointments.startTime, input.from),
        lte(appointments.startTime, input.to),
      ];

      if (input.vetId) {
        conditions.push(eq(appointments.vetId, input.vetId));
      }

      // Get all appointments in period
      const appts = await ctx.db
        .select({
          id: appointments.id,
          status: appointments.status,
          source: appointments.source,
          startTime: appointments.startTime,
          endTime: appointments.endTime,
          vetId: appointments.vetId,
        })
        .from(appointments)
        .where(and(...conditions));

      // Calculate metrics
      const totalAppointments = appts.length;
      const completedCount = appts.filter((a) => a.status === "completed").length;
      const completionRate = totalAppointments > 0 ? (completedCount / totalAppointments) * 100 : 0;

      const noShowCount = appts.filter((a) => a.status === "no-show").length;
      const noShowRate = totalAppointments > 0 ? (noShowCount / totalAppointments) * 100 : 0;

      // Online booking conversion: (confirmed or completed) / online_bookings
      const onlineBookings = appts.filter((a) => a.source === "online_booking");
      const convertedOnline = onlineBookings.filter(
        (a) => a.status === "confirmed" || a.status === "completed"
      ).length;
      const onlineConversionRate =
        onlineBookings.length > 0 ? (convertedOnline / onlineBookings.length) * 100 : 0;

      // Average duration
      const durations = appts
        .map((a) => {
          const ms = new Date(a.endTime).getTime() - new Date(a.startTime).getTime();
          return ms / 60000; // Convert to minutes
        })
        .filter((d) => d > 0);
      const avgDuration = durations.length > 0 ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0;

      // Source breakdown
      const sourceBreakdown = {
        manual: appts.filter((a) => a.source === "manual").length,
        voice_ai: appts.filter((a) => a.source === "voice_ai").length,
        online_booking: appts.filter((a) => a.source === "online_booking").length,
        import: appts.filter((a) => a.source === "import").length,
      };

      const voiceAICount = sourceBreakdown.voice_ai;
      const voiceAIRate =
        totalAppointments > 0 ? (voiceAICount / totalAppointments) * 100 : 0;

      // New patients in period
      const newPatients = await ctx.db
        .select({ count: count() })
        .from(patients)
        .where(
          and(
            eq(patients.tenantId, input.tenantId),
            gte(patients.createdAt, input.from),
            lte(patients.createdAt, input.to)
          )
        );

      // Returning patients: patients with 2+ appointments (regardless of period)
      const patientAppointmentCounts = await ctx.db
        .select({
          patientId: appointments.patientId,
          count: count().as("apptCount"),
        })
        .from(appointments)
        .where(eq(appointments.tenantId, input.tenantId))
        .groupBy(appointments.patientId);

      const returningPatientCount = patientAppointmentCounts.filter((p) => p.count >= 2).length;
      const totalUniquePatients = patientAppointmentCounts.length;
      const returningRate = totalUniquePatients > 0 ? (returningPatientCount / totalUniquePatients) * 100 : 0;

      // Email delivery rate — from universal email_logs table
      const [emailRow] = await ctx.db
        .select({
          total: sql<number>`count(*)`,
          sent: sql<number>`count(*) filter (where ${emailLogs.status} = 'sent')`,
          failed: sql<number>`count(*) filter (where ${emailLogs.status} = 'failed')`,
        })
        .from(emailLogs)
        .where(
          and(
            eq(emailLogs.tenantId, input.tenantId),
            gte(emailLogs.sentAt, input.from),
            lte(emailLogs.sentAt, input.to)
          )
        );

      const emailTotal = Number(emailRow?.total ?? 0);
      const emailSent = Number(emailRow?.sent ?? 0);
      const emailFailed = Number(emailRow?.failed ?? 0);
      const emailDeliveryRate = emailTotal > 0 ? (emailSent / emailTotal) * 100 : 0;

      return {
        totalAppointments,
        completionRate: Math.round(completionRate * 10) / 10,
        noShowRate: Math.round(noShowRate * 10) / 10,
        onlineConversionRate: Math.round(onlineConversionRate * 10) / 10,
        avgDuration,
        newPatients: newPatients[0]?.count || 0,
        returningRate: Math.round(returningRate * 10) / 10,
        emailDeliveryRate: Math.round(emailDeliveryRate * 10) / 10,
        emailFailed,
        voiceAIBookings: voiceAICount,
        voiceAIRate: Math.round(voiceAIRate * 10) / 10,
        sourceBreakdown,
      };
    }),

  getTrendData: protectedProcedure
    .input(
      z.object({
        tenantId: z.string().uuid(),
        from: z.date(),
        to: z.date(),
        groupBy: z.enum(["day", "week", "month"]).default("day"),
      })
    )
    .query(async ({ ctx, input }) => {
      const appts = await ctx.db
        .select({
          startTime: appointments.startTime,
          status: appointments.status,
        })
        .from(appointments)
        .where(
          and(
            eq(appointments.tenantId, input.tenantId),
            gte(appointments.startTime, input.from),
            lte(appointments.startTime, input.to)
          )
        );

      // Group by date/week/month
      const grouped: Record<string, { total: number; completed: number }> = {};

      appts.forEach((a) => {
        const date = new Date(a.startTime);
        let key: string;

        if (input.groupBy === "day") {
          key = date.toISOString().split("T")[0]; // YYYY-MM-DD
        } else if (input.groupBy === "week") {
          const week = Math.floor(
            (date.getTime() - new Date(date.getFullYear(), 0, 1).getTime()) /
              (7 * 24 * 60 * 60 * 1000)
          );
          key = `W${week}-${date.getFullYear()}`;
        } else {
          key = date.toISOString().substring(0, 7); // YYYY-MM
        }

        if (!grouped[key]) {
          grouped[key] = { total: 0, completed: 0 };
        }
        grouped[key].total++;
        if (a.status === "completed") {
          grouped[key].completed++;
        }
      });

      // Convert to sorted array
      const trend = Object.entries(grouped)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([period, data]) => ({
          period,
          count: data.total,
          completedCount: data.completed,
          completionRate: data.total > 0 ? Math.round((data.completed / data.total) * 100) : 0,
        }));

      return trend;
    }),

  getVetUtilization: protectedProcedure
    .input(
      z.object({
        tenantId: z.string().uuid(),
        from: z.date(),
        to: z.date(),
      })
    )
    .query(async ({ ctx, input }) => {
      // Get all vets
      const vets = await ctx.db
        .select({ id: users.id, firstName: users.firstName, lastName: users.lastName })
        .from(users)
        .where(and(eq(users.tenantId, input.tenantId)));

      const utilization = await Promise.all(
        vets.map(async (vet) => {
          // Count appointments for this vet in period
          const apptCount = await ctx.db
            .select({ count: count() })
            .from(appointments)
            .where(
              and(
                eq(appointments.tenantId, input.tenantId),
                eq(appointments.vetId, vet.id),
                gte(appointments.startTime, input.from),
                lte(appointments.startTime, input.to)
              )
            );

          // Calculate available slots: vet_schedules * days in period * slots per day
          // For simplicity, assume 30-min slots, 8-18 working hours = 20 slots/day
          const daysDiff = Math.ceil(
            (input.to.getTime() - input.from.getTime()) / (24 * 60 * 60 * 1000)
          );
          const workingDays = Math.ceil(daysDiff * 0.7); // Rough estimate: 70% working days
          const slotsPerDay = 20; // 8am-6pm with 30-min slots
          const availableSlots = workingDays * slotsPerDay;

          const booked = apptCount[0]?.count || 0;
          const utilPercent = availableSlots > 0 ? Math.round((booked / availableSlots) * 100) : 0;

          return {
            vetId: vet.id,
            name: `${vet.firstName} ${vet.lastName}`,
            appointments: booked,
            utilization: utilPercent,
          };
        })
      );

      return utilization.sort((a, b) => b.appointments - a.appointments);
    }),

  getStatusDistribution: protectedProcedure
    .input(
      z.object({
        tenantId: z.string().uuid(),
        from: z.date(),
        to: z.date(),
      })
    )
    .query(async ({ ctx, input }) => {
      const appts = await ctx.db
        .select({
          status: appointments.status,
          count: count().as("count"),
        })
        .from(appointments)
        .where(
          and(
            eq(appointments.tenantId, input.tenantId),
            gte(appointments.startTime, input.from),
            lte(appointments.startTime, input.to)
          )
        )
        .groupBy(appointments.status);

      return appts.map((a) => ({
        status: a.status,
        count: a.count,
      }));
    }),

  getPatientGrowth: protectedProcedure
    .input(
      z.object({
        tenantId: z.string().uuid(),
        from: z.date(),
        to: z.date(),
      })
    )
    .query(async ({ ctx, input }) => {
      // Get all patients with their creation date
      const allPatients = await ctx.db
        .select({ createdAt: patients.createdAt })
        .from(patients)
        .where(eq(patients.tenantId, input.tenantId))
        .orderBy(asc(patients.createdAt));

      // Build cumulative growth
      const growth: Array<{ date: string; totalPatients: number }> = [];
      let cumulative = 0;

      // Group by date
      const byDate: Record<string, number> = {};
      allPatients.forEach((p) => {
        const dateStr = new Date(p.createdAt).toISOString().split("T")[0];
        byDate[dateStr] = (byDate[dateStr] || 0) + 1;
      });

      // Create cumulative array for period
      const current = new Date(input.from);
      while (current <= input.to) {
        const dateStr = current.toISOString().split("T")[0];
        cumulative += byDate[dateStr] || 0;
        growth.push({ date: dateStr, totalPatients: cumulative });
        current.setDate(current.getDate() + 1);
      }

      return growth;
    }),

  getSourceComparison: protectedProcedure
    .input(
      z.object({
        tenantId: z.string().uuid(),
        from: z.date(),
        to: z.date(),
      })
    )
    .query(async ({ ctx, input }) => {
      const appts = await ctx.db
        .select({
          source: appointments.source,
          status: appointments.status,
          count: count().as("count"),
        })
        .from(appointments)
        .where(
          and(
            eq(appointments.tenantId, input.tenantId),
            gte(appointments.startTime, input.from),
            lte(appointments.startTime, input.to)
          )
        )
        .groupBy(appointments.source, appointments.status);

      // Aggregate by source
      const bySource: Record<string, { total: number; completed: number }> = {};

      appts.forEach((a) => {
        if (!bySource[a.source]) {
          bySource[a.source] = { total: 0, completed: 0 };
        }
        bySource[a.source].total += a.count;
        if (a.status === "completed") {
          bySource[a.source].completed += a.count;
        }
      });

      return Object.entries(bySource).map(([source, data]) => ({
        source,
        total: data.total,
        completed: data.completed,
        completionRate: data.total > 0 ? Math.round((data.completed / data.total) * 100) : 0,
      }));
    }),
});
