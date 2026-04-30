"use client";

import { ReactNode } from "react";
import { User } from "lucide-react";

export default function UserSettingsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center"
          style={{ backgroundColor: "var(--color-accent-soft)" }}
        >
          <User size={20} style={{ color: "var(--color-accent)" }} />
        </div>
        <h1 className="text-lg sm:text-2xl font-bold">Benutzereinstellungen</h1>
      </div>

      {/* Content */}
      <div>{children}</div>
    </div>
  );
}
