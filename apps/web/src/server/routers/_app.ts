import { createTRPCRouter } from "@/server/trpc";
import { appointmentsRouter } from "./appointments";
import { patientsRouter } from "./patients";
import { bookingRouter } from "./booking";
import { adminRouter } from "./admin";
import { medicalRouter } from "./medical";
import { vetRouter } from "./vet";
import { emailRouter } from "./email";
import { tenantRouter } from "./tenant";
import { statisticsRouter } from "./statistics";
import { scheduleRouter } from "./schedule";
import { calendarRouter } from "./calendar";
import { userRouter } from "./user";

export const appRouter = createTRPCRouter({
  appointments: appointmentsRouter,
  patients: patientsRouter,
  booking: bookingRouter,
  admin: adminRouter,
  medical: medicalRouter,
  vet: vetRouter,
  email: emailRouter,
  tenant: tenantRouter,
  statistics: statisticsRouter,
  schedule: scheduleRouter,
  calendar: calendarRouter,
  user: userRouter,
});

export type AppRouter = typeof appRouter;
