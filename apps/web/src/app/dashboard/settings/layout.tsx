"use client";

import { ReactNode, useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Palette, Users, ArrowLeft, Building2, Mail, CalendarClock } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { PERMISSIONS } from "@/lib/db/schema";

const ALL_TABS = [
  { href: "/dashboard/settings/practice", label: "Praxis", icon: Building2 },
  { href: "/dashboard/settings/appearance", label: "Erscheinungsbild", icon: Palette },
  { href: "/dashboard/settings/email", label: "E-Mails", icon: Mail },
  { href: "/dashboard/settings/availability", label: "Verfügbarkeit", icon: CalendarClock },
  { href: "/dashboard/settings/team", label: "Team & Benutzer", icon: Users, requiredPermission: PERMISSIONS.USERS_MANAGE },
];

export default function SettingsLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { data: permissions } = trpc.admin.getUserPermissions.useQuery();

  const tabs = useMemo(() => {
    return ALL_TABS.filter(tab => {
      if (!tab.requiredPermission) return true;
      return permissions?.includes(tab.requiredPermission);
    });
  }, [permissions]);

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
        <Link
          href="/dashboard"
          className="flex items-center gap-1.5 text-sm hover:opacity-70 transition-opacity"
          style={{ color: "var(--color-muted)" }}
        >
          <ArrowLeft size={16} />
          <span className="hidden sm:inline">Dashboard</span>
        </Link>
        <span style={{ color: "var(--color-border)" }} className="hidden sm:inline">/</span>
        <h1 className="text-lg sm:text-2xl font-bold">Praxisverwaltung</h1>
      </div>

      {/* Tabs - Scrollable on mobile */}
      <div
        className="overflow-x-auto -mx-4 sm:mx-0 border-b"
        style={{ borderColor: "var(--color-border)" }}
      >
        <div className="flex gap-1 px-4 sm:px-0 min-w-min sm:min-w-full">
          {tabs.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2.5 text-xs sm:text-sm font-medium transition-colors border-b-2 -mb-px whitespace-nowrap flex-shrink-0"
                style={{
                  borderColor: active ? "var(--color-accent)" : "transparent",
                  color: active ? "var(--color-accent)" : "var(--color-muted)",
                }}
              >
                <Icon size={16} />
                <span className="hidden sm:inline">{label}</span>
                <span className="sm:hidden">{label.split(" ")[0]}</span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div>{children}</div>
    </div>
  );
}
