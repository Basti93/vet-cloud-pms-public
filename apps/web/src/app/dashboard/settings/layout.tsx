"use client";

import { ReactNode, useMemo, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Palette, Users, Building2, Mail, CalendarClock, User } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { PERMISSIONS } from "@/lib/db/schema";
import { Tabs } from "@/components/ui/tabs";

const ALL_TABS = [
  { href: "/dashboard/settings/practice", label: "Praxis", icon: Building2 },
  { href: "/dashboard/settings/appearance", label: "Erscheinungsbild", icon: Palette },
  { href: "/dashboard/settings/email", label: "E-Mails", icon: Mail },
  { href: "/dashboard/settings/availability", label: "Verfügbarkeit", icon: CalendarClock },
  { href: "/dashboard/settings/team", label: "Team & Benutzer", icon: Users, requiredPermission: PERMISSIONS.USERS_MANAGE },
  { href: "/dashboard/settings/account", label: "Benutzerkonto", icon: User },
];

export default function SettingsLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const { data: permissions } = trpc.admin.getUserPermissions.useQuery();

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  // Check permission and redirect if user doesn't have SETTINGS_MANAGE
  useEffect(() => {
    if (mounted && permissions && !permissions.includes(PERMISSIONS.SETTINGS_MANAGE)) {
      router.push("/dashboard");
    }
  }, [permissions, mounted, router]);

  // Don't render until permission check is complete
  if (!mounted) return null;

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
        <h1 className="text-lg sm:text-2xl font-bold">Praxisverwaltung</h1>
      </div>

      {/* Tabs Component */}
      <Tabs tabs={ALL_TABS} currentPath={pathname} permissions={permissions} />

      {/* Content */}
      <div>{children}</div>
    </div>
  );
}
