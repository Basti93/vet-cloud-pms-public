import { createTRPCReact } from "@trpc/react-query";

// TODO: replace with shared AppRouter type package once cross-workspace path aliases are unified.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const trpc: any = createTRPCReact<any>();
