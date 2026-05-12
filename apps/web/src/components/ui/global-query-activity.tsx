"use client";

import { useEffect, useRef, useState } from "react";
import { useIsFetching, useIsMutating } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useLocale } from "@/lib/user/preferences-context";

const SHOW_DELAY_MS = 180;
const MIN_VISIBLE_MS = 320;

export function GlobalQueryActivity() {
  const fetchingCount = useIsFetching();
  const mutatingCount = useIsMutating();
  const isActive = fetchingCount + mutatingCount > 0;
  const [visible, setVisible] = useState(false);
  const shownAtRef = useRef<number | null>(null);
  const { t } = useLocale();

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    if (isActive) {
      timeoutId = setTimeout(() => {
        shownAtRef.current = Date.now();
        setVisible(true);
      }, SHOW_DELAY_MS);
    } else if (visible) {
      const shownAt = shownAtRef.current ?? Date.now();
      const elapsed = Date.now() - shownAt;
      const hideDelay = Math.max(0, MIN_VISIBLE_MS - elapsed);
      timeoutId = setTimeout(() => {
        setVisible(false);
        shownAtRef.current = null;
      }, hideDelay);
    }

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [isActive, visible]);

  if (!visible) return null;

  return (
    <div className="pointer-events-none fixed right-4 top-4 z-[120]">
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-medium text-fg shadow-sm"
      >
        <Loader2 className="h-3.5 w-3.5 animate-spin text-[var(--color-accent)]" aria-hidden="true" />
        <span>{t("common.loading")}</span>
      </div>
    </div>
  );
}

