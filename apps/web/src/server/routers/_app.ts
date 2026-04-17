import { createTRPCRouter } from "@/server/trpc";
import { appointmentsRouter } from "./appointments";
import { patientsRouter } from "./patients";
import { bookingRouter } from "./booking";
import { adminRouter } from "./admin";

export const appRouter = createTRPCRouter({
  appointments: appointmentsRouter,
  patients: patientsRouter,
  booking: bookingRouter,
  admin: adminRouter,
});

export type AppRouter = typeof appRouter;
