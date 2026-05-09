"use client";

import { trpc } from "@/lib/trpc";

export function HealthStatus() {
  const { data, isLoading } = trpc.adminDashboard.health.getStatus.useQuery(undefined, {
    refetchInterval: 300_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-xs text-gray-400">
        <span className="h-2 w-2 rounded-full bg-gray-300 animate-pulse" />
        System…
      </div>
    );
  }

  const ok = data?.status === "ok";

  return (
    <div className="text-xs" title={`DB: ${data?.db} · ${data?.dbLatencyMs}ms`}>
      <div className="flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${ok ? "bg-green-500" : "bg-red-500"}`} />
        <span className={ok ? "text-green-700" : "text-red-700"}>
          {ok ? "System OK" : "Degraded"}
        </span>
      </div>
      <p className="mt-1 text-[11px] text-gray-500">
        {ok
          ? "API erreichbar, Datenbank antwortet."
          : "Mindestens ein Kernservice antwortet nicht stabil."}
      </p>
    </div>
  );
}
