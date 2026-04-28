"use client";

import { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Palette, Users, ArrowLeft, Building2, Mail, CalendarClock, Calendar } from "lucide-react";

const PRACTICE_SETTINGS = [
  { href: "/dashboard/settings/practice", label: "Praxis", icon: Building2 },
  { href: "/dashboard/settings/appearance", label: "Erscheinungsbild", icon: Palette },
  { href: "/dashboard/settings/email", label: "E-Mails", icon: Mail },
  { href: "/dashboard/settings/team", label: "Team & Benutzer", icon: Users },
];

const PERSONAL_SETTINGS = [
  { href: "/dashboard/settings/availability", label: "Verfügbarkeit", icon: CalendarClock },
  { href: "/dashboard/settings/calendar-sync", label: "Kalender Export", icon: Calendar },
];

export default function SettingsLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isCalendarSync = pathname === "/dashboard/settings/calendar-sync";
  const headerTitle = isCalendarSync ? "Kalender Export" : "Praxisverwaltung";

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
        <h1 className="text-2xl font-bold">{headerTitle}</h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b flex-wrap" style={{ borderColor: "var(--color-border)" }}>
        {/* Practice Settings */}
        {PRACTICE_SETTINGS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px"
              style={{
                borderColor: active ? "var(--color-accent)" : "transparent",
                color: active ? "var(--color-accent)" : "var(--color-muted)",
              }}
            >
              <Icon size={16} />
              {label}
            </Link>
          );
        })}

        {/* Divider */}
        <div style={{ width: "1px", backgroundColor: "var(--color-border)", margin: "0.5rem 0" }} />

        {/* Personal Settings */}
        {PERSONAL_SETTINGS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px"
              style={{
                borderColor: active ? "var(--color-accent)" : "transparent",
                color: active ? "var(--color-accent)" : "var(--color-muted)",
              }}
            >
              <Icon size={16} />
              {label}
            </Link>
          );
        })}
      </div>

      {/* Content */}
      <div>{children}</div>
    </div>
  );
}
