import { QueryClient } from "@tanstack/react-query";

export function getBaseUrl() {
  const apiUrl = process.env.NEXT_PUBLIC_WEB_API_URL?.trim();
  if (apiUrl) {
    return apiUrl.replace(/\/+$/, "");
  }

  // During server-side rendering / prerender at build time, avoid hard-failing.
  // Runtime safety is enforced in the browser branch below.
  if (typeof window === "undefined") {
    return process.env.NODE_ENV === "production"
      ? "https://example.com"
      : "http://localhost:3000";
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
  return "http://localhost:3000";
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000, // 1 minute
    },
  },
});
