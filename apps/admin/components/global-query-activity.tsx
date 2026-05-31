"use client";

import { useEffect, useRef, useState } from "react";
import { useIsFetching, useIsMutating } from "@tanstack/react-query";

const SHOW_DELAY_MS = 180;
const MIN_VISIBLE_MS = 320;

function getLoadingLabel() {
  if (typeof window === "undefined") return "Loading data...";
  const docLang = document.documentElement.lang;
  const browserLang = navigator.language;
  const lang = (docLang || browserLang || "en").toLowerCase();
  return lang.startsWith("de") ? "Lädt Daten..." : "Loading data...";
}

export function GlobalQueryActivity() {
  const fetchingCount = useIsFetching();
  const mutatingCount = useIsMutating();
  const isActive = fetchingCount + mutatingCount > 0;
  const [visible, setVisible] = useState(false);
  const [label] = useState(() => getLoadingLabel());
  const shownAtRef = useRef<number | null>(null);

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
        className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-800 shadow-sm"
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="h-3.5 w-3.5 animate-spin text-blue-600"
          fill="none"
        >
          <circle cx="12" cy="12" r="10" className="opacity-25" stroke="currentColor" strokeWidth="3" />
          <path className="opacity-90" fill="currentColor" d="M12 2a10 10 0 0 1 10 10h-3a7 7 0 0 0-7-7V2Z" />
        </svg>
        <span>{label}</span>
      </div>
    </div>
  );
}
