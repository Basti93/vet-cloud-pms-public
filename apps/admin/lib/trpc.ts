import { createTRPCReact } from "@trpc/react-query";

// Using any for now due to type resolution issues with nested adminDashboard router
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const trpc = createTRPCReact<any>();
