"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";

export interface TrialWarningBannerProps {
  daysUntilTrialEnds: number | null;
}

export function TrialWarningBanner({ daysUntilTrialEnds }: TrialWarningBannerProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || daysUntilTrialEnds == null || daysUntilTrialEnds > 7) {
    return null;
  }

  if (daysUntilTrialEnds <= 0) {
    return (
      <div className="mb-6 p-4 rounded-lg border-2 border-red-200 bg-red-50">
        <div className="flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0" />
          <div className="flex-1">
            <p className="font-semibold text-red-900">Testphase beendet</p>
            <p className="text-sm text-red-800">
              Ihre Testphase ist vorbei. Aktivieren Sie jetzt ein Abo, um weiter Zugriff zu haben.
            </p>
          </div>
          <Link
            href={`/dashboard/settings/account`}
            className="ml-4 px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors flex-shrink-0"
          >
            Upgraden
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-6 p-4 rounded-lg border-2 border-orange-200 bg-orange-50">
      <div className="flex items-center gap-3">
        <AlertTriangle className="h-5 w-5 text-orange-600 flex-shrink-0" />
        <div className="flex-1">
          <p className="font-semibold text-orange-900">
            Testphase endet in {daysUntilTrialEnds} {daysUntilTrialEnds === 1 ? "Tag" : "Tagen"}
          </p>
          <p className="text-sm text-orange-800">
            Nach dieser Zeit wird die Klinik deaktiviert. Aktivieren Sie jetzt ein Abo.
          </p>
        </div>
        <Link
          href={`/dashboard/settings/account`}
          className="ml-4 px-4 py-2 rounded-lg bg-orange-600 text-white text-sm font-medium hover:bg-orange-700 transition-colors flex-shrink-0"
        >
          Upgraden
        </Link>
      </div>
    </div>
  );
}
