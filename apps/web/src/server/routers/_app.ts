import { createTRPCRouter } from "@/server/trpc";
import { appointmentsRouter } from "./appointments";
import { patientsRouter } from "./patients";
import { bookingRouter } from "./booking";

export const appRouter = createTRPCRouter({
  appointments: appointmentsRouter,
  patients: patientsRouter,
  booking: bookingRouter,
});

export type AppRouter = typeof appRouter;
