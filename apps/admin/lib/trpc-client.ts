import { QueryClient } from "@tanstack/react-query";

export function getBaseUrl() {
  // Browser should always call admin app same-origin (/api/trpc).
  if (typeof window !== "undefined") return "";
  // Server-side fallback for local/dev execution.
  return "http://localhost:3001";
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000, // 1 minute
    },
  },
});
