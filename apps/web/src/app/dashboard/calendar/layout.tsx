"use client";

import { ReactNode } from "react";

export default function CalendarLayout({ children }: { children: ReactNode }) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <h1 className="text-2xl font-bold">Kalender Export</h1>
      </div>

      {/* Content */}
      <div>{children}</div>
    </div>
  );
}
