"use client";

import { Info } from "lucide-react";
import { useState } from "react";
import { useLocale } from "@/lib/user/preferences-context";

interface StatusExplanation {
  status: string;
  description: string;
}

export function StatusTooltip() {
  const [hoveredStatus, setHoveredStatus] = useState<string | null>(null);
  const { t } = useLocale();

  const STATUS_EXPLANATIONS: Record<string, StatusExplanation> = {
    scheduled: {
      status: t("status.scheduled"),
      description: t("status.scheduled_description"),
    },
    confirmed: {
      status: t("status.confirmed"),
      description: t("status.confirmed_description"),
    },
    completed: {
      status: t("status.completed"),
      description: t("status.completed_description"),
    },
    cancelled: {
      status: t("status.cancelled"),
      description: t("status.cancelled_description"),
    },
    "no-show": {
      status: t("status.no_show"),
      description: t("status.no_show_description"),
    },
    "pending-confirmation": {
      status: t("status.pending_confirmation"),
      description: t("status.pending_confirmation_description"),
    },
  };

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onMouseEnter={() => setHoveredStatus("info")}
        onMouseLeave={() => setHoveredStatus(null)}
        className="p-1 rounded-full hover:bg-muted-soft transition-colors"
        title="Status-Erklärung"
      >
        <Info size={16} style={{ color: "var(--color-muted)" }} />
      </button>

      {hoveredStatus === "info" && (
        <div
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 rounded-lg shadow-lg p-3 w-48 text-xs whitespace-normal"
          style={{ backgroundColor: "var(--color-fg)", color: "white" }}
        >
          <div className="space-y-2">
            {Object.entries(STATUS_EXPLANATIONS).map(([key, { status, description }]) => (
              <div key={key}>
                <p className="font-semibold" style={{ color: "white" }}>{status}</p>
                <p style={{ color: "rgba(255, 255, 255, 0.8)" }}>{description}</p>
              </div>
            ))}
          </div>
          <div
            className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 w-2 h-2 transform rotate-45"
            style={{ backgroundColor: "var(--color-fg)" }}
          />
        </div>
      )}
    </div>
  );
}
