import { createTRPCRouter } from "@/server/trpc";
import { appointmentsRouter } from "./appointments";
import { patientsRouter } from "./patients";
import { bookingRouter } from "./booking";
import { adminRouter } from "./admin";
import { adminCoreRouter } from "./admin-core";
import { adminLogsRouter } from "./admin-logs";
import { adminUsersRouter } from "./admin-users";
import { adminHealthRouter } from "./admin-health";
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
  adminDashboard: createTRPCRouter({
    core: adminCoreRouter,
    logs: adminLogsRouter,
    users: adminUsersRouter,
    health: adminHealthRouter,
  }),
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
