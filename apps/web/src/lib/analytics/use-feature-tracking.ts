"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { trackEvent } from "@/lib/analytics/tracker";
import { AnalyticsEvents, FeatureNames } from "@/lib/analytics/events";

const PATH_TO_FEATURE: Record<string, string> = {
  "/dashboard": FeatureNames.CALENDAR,
  "/dashboard/schedule": FeatureNames.CALENDAR,
  "/dashboard/appointments": FeatureNames.APPOINTMENTS,
  "/dashboard/patients": FeatureNames.PATIENTS,
  "/dashboard/vaccinations": FeatureNames.VACCINATIONS,
  "/dashboard/bookings": FeatureNames.BOOKINGS,
  "/dashboard/statistics": FeatureNames.STATISTICS,
  "/dashboard/voice": FeatureNames.VOICE,
  "/dashboard/settings": FeatureNames.SETTINGS,
  "/dashboard/settings/team": FeatureNames.TEAM,
  "/dashboard/settings/practice": FeatureNames.SETTINGS,
};

export function useFeatureTracking() {
  const pathname = usePathname();

  useEffect(() => {
    const feature = PATH_TO_FEATURE[pathname];
    if (feature) {
      trackEvent(AnalyticsEvents.FEATURE_USED, { feature, path: pathname });
    }
  }, [pathname]);
}