import { createTRPCRouter } from "@/server/trpc";
import { appointmentsRouter } from "./appointments";
import { patientsRouter } from "./patients";
import { ownersRouter } from "./owners";
import { bookingRouter } from "./booking";
import { adminRouter } from "./admin";
import { adminCoreRouter } from "./admin-core";
import { adminLogsRouter } from "./admin-logs";
import { adminUsersRouter } from "./admin-users";
import { adminRemindersRouter } from "./admin-reminders";
import { adminAuditRouter } from "./admin-audit";
import { adminContactRequestsRouter } from "./admin-contact-requests";
import { adminFeedbackRouter } from "./admin-feedback";
import { medicalRouter } from "./medical";
import { vetRouter } from "./vet";
import { emailRouter } from "./email";
import { tenantRouter } from "./tenant";
import { statisticsRouter } from "./statistics";
import { scheduleRouter } from "./schedule";
import { calendarRouter } from "./calendar";
import { userRouter } from "./user";
import { vaccinationsRouter } from "./vaccinations";
import { vaccinationSettingsRouter } from "./vaccinationSettings";
import { adminVaccinationsRouter } from "./admin-vaccinations";
import { subscriptionsRouter } from "./subscriptions";
import { websitePlatformRouter } from "./website-platform";
import { feedbackRouter } from "./feedback";
import { emailLogsRouter } from "./emailLogs";

export const appRouter = createTRPCRouter({
  appointments: appointmentsRouter,
  owners: ownersRouter,
  patients: patientsRouter,
  booking: bookingRouter,
  admin: adminRouter,
  adminDashboard: createTRPCRouter({
    core: adminCoreRouter,
    logs: adminLogsRouter,
    users: adminUsersRouter,
    reminders: adminRemindersRouter,
    audit: adminAuditRouter,
    vaccinations: adminVaccinationsRouter,
    contactRequests: adminContactRequestsRouter,
    feedback: adminFeedbackRouter,
    emailLogs: emailLogsRouter,
  }),
  medical: medicalRouter,
  vet: vetRouter,
  email: emailRouter,
  tenant: tenantRouter,
  statistics: statisticsRouter,
  schedule: scheduleRouter,
  calendar: calendarRouter,
  user: userRouter,
  vaccinations: vaccinationsRouter,
  vaccinationSettings: vaccinationSettingsRouter,
  subscriptions: subscriptionsRouter,
  websitePlatform: websitePlatformRouter,
  feedback: feedbackRouter,
});

export type AppRouter = typeof appRouter;
