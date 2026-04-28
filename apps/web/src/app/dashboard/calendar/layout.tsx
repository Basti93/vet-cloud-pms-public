"use client";

import { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function CalendarLayout({ children }: { children: ReactNode }) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/dashboard"
          className="flex items-center gap-1.5 text-sm hover:opacity-70 transition-opacity"
          style={{ color: "var(--color-muted)" }}
        >
          <ArrowLeft size={16} />
          Dashboard
        </Link>
        <span style={{ color: "var(--color-border)" }}>/</span>
        <h1 className="text-2xl font-bold">Kalender Export</h1>
      </div>

      {/* Content */}
      <div>{children}</div>
    </div>
  );
}
