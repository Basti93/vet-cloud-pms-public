import { isDevelopment } from "@/lib/env";

export function trackEvent(
  name: string,
  data?: Record<string, string | number | boolean>
) {
  if (isDevelopment()) return;
  if (typeof window === "undefined") return;

  const umami = (window as unknown as Record<string, unknown>).umami;
  if (typeof umami === "object" && umami !== null && "track" in umami) {
    try {
      (umami as { track: (name: string, data?: Record<string, string | number | boolean>) => void }).track(name, data);
    } catch {
      // Silently fail — analytics must never break the app
    }
  }
}