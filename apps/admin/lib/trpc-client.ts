import { QueryClient } from "@tanstack/react-query";

export function getBaseUrl() {
  const apiUrl = process.env.NEXT_PUBLIC_WEB_API_URL;
  if (apiUrl) {
    return apiUrl;
  }
  return "http://localhost:3000";
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000, // 1 minute
    },
  },
});
