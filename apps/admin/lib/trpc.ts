import { createTRPCReact } from "@trpc/react-query";

// Using any for now due to type resolution issues with nested adminDashboard router
export const trpc = createTRPCReact<any>();
