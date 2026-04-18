import { createTRPCRouter } from "@/server/trpc";
import { appointmentsRouter } from "./appointments";
import { patientsRouter } from "./patients";
import { bookingRouter } from "./booking";
import { adminRouter } from "./admin";
import { medicalRouter } from "./medical";
import { vetRouter } from "./vet";
import { emailRouter } from "./email";

export const appRouter = createTRPCRouter({
  appointments: appointmentsRouter,
  patients: patientsRouter,
  booking: bookingRouter,
  admin: adminRouter,
  medical: medicalRouter,
  vet: vetRouter,
  email: emailRouter,
});

export type AppRouter = typeof appRouter;
