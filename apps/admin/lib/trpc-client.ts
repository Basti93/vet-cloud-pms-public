import { QueryClient } from "@tanstack/react-query";

export function getBaseUrl() {
  const apiUrl = process.env.NEXT_PUBLIC_WEB_API_URL?.trim();
  if (apiUrl) {
    return apiUrl.replace(/\/+$/, "");
  }

  if (typeof window !== "undefined") {
    const { hostname } = window.location;

    if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1") {
      return "http://localhost:3000";
    }
    throw new Error(
      "NEXT_PUBLIC_WEB_API_URL is required for non-localhost environments."
    );
  }

  return process.env.NODE_ENV === "production"
    ? (() => {
        throw new Error(
          "NEXT_PUBLIC_WEB_API_URL is required in production."
        );
      })()
    : "http://localhost:3000";
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000, // 1 minute
    },
  },
});
