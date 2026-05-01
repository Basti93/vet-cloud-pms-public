"use client";

import { ReactNode, useState } from "react";
import { UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { LayoutDashboard, Calendar, Users, Phone, ClipboardList, Clock, Menu, X, Settings, TrendingUp, ChevronDown, User, Building2 } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { useLocale } from "@/lib/user/preferences-context";
import { usePraxis } from "@/lib/praxis/context";

function useNavItems() {
  const { t } = useLocale();
  return [
    { href: "/dashboard", icon: LayoutDashboard, labelKey: "navigation.overview" },
    { href: "/dashboard/schedule", icon: Calendar, labelKey: "navigation.calendar" },
    { href: "/dashboard/appointments", icon: Clock, labelKey: "navigation.appointments" },
    { href: "/dashboard/patients", icon: Users, labelKey: "navigation.patients" },
    { href: "/dashboard/bookings", icon: ClipboardList, labelKey: "navigation.bookings" },
    { href: "/dashboard/statistics", icon: TrendingUp, labelKey: "navigation.statistics" },
  ].map(item => ({ ...item, label: t(item.labelKey) }));
}

function useBetaNavItems() {
  const { t } = useLocale();
  return [
    { href: "/dashboard/voice", icon: Phone, labelKey: "navigation.voice", label: t("navigation.voice") },
  ];
}

function useUserNavItems() {
  return [
    { href: "/dashboard/user-settings", icon: User, label: "Benutzereinstellungen" },
  ];
}

function useAdminNavItems() {
  const { t } = useLocale();
  return [
    { href: "/dashboard/settings", icon: Building2, labelKey: "navigation.settings", label: t("navigation.settings"), adminOnly: true },
  ];
}

export default function DashboardContent({ children }: { children: ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [settingsExpanded, setSettingsExpanded] = useState(false);
  const { praxis } = usePraxis(); // Tenant name already loaded server-side
  const { data: user, isLoading: userLoading } = trpc.admin.getCurrentUser.useQuery();
  const { data: featureFlags } = trpc.tenant.getFeatureFlags.useQuery();
  const { t } = useLocale();
  const NAV_ITEMS = useNavItems();
  const BETA_NAV_ITEMS = useBetaNavItems();
  const USER_NAV_ITEMS = useUserNavItems();
  const ADMIN_NAV_ITEMS = useAdminNavItems();

  return (
    <div className="flex h-screen overflow-hidden" style={{ backgroundColor: 'var(--color-bg)' }}>
      {/* Sidebar */}
      <aside
        className={`${sidebarOpen ? "w-64" : "hidden md:w-64"} md:block text-white flex flex-col flex-shrink-0 fixed md:static h-full z-40`}
        style={{ backgroundColor: 'var(--color-accent)' }}
      >
        <div className="px-6 py-5 border-b" style={{ borderColor: 'var(--color-border-strong)' }}>
          <div className="flex items-center gap-2.5 justify-between">
            <div className="flex items-center gap-2.5">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold"
                style={{ backgroundColor: 'var(--color-accent-soft)' }}
              >
                {praxis?.monogram || praxis?.tenantName?.charAt(0).toUpperCase() || 'VC'}
              </div>
              <div>
                <p className="font-bold text-sm leading-tight">{praxis?.tenantName || 'Vet Cloud'}</p>
                <p className="text-xs leading-tight" style={{ color: 'var(--color-accent-soft)' }}>
                  {praxis?.tenantName ? 'Praxis' : 'Praxisverwaltung'}
                </p>
              </div>
            </div>
            <button onClick={() => setSidebarOpen(false)} className="md:hidden p-1 hover:opacity-80 rounded-lg transition-colors">
              <X size={20} />
            </button>
          </div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-4">
          <div className="space-y-1">
            {NAV_ITEMS.map(({ href, icon: Icon, label }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setSidebarOpen(false)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium hover:opacity-90 transition-colors group"
                style={{ color: 'var(--color-accent-soft)' }}
              >
                <Icon size={18} />
                {label}
              </Link>
            ))}
          </div>

          {/* Beta Section - Only show if features are enabled */}
          {featureFlags?.aiReceptionEnabled && (
            <div className="space-y-2">
              <p
                className="px-3 text-xs font-semibold uppercase tracking-wider"
                style={{ color: 'var(--color-accent-soft)', opacity: 0.6 }}
              >
                {t("navigation.beta")}
              </p>
              <div className="space-y-1">
                {BETA_NAV_ITEMS.map(({ href, icon: Icon, label }) => (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setSidebarOpen(false)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium hover:opacity-90 transition-colors group"
                    style={{ color: 'var(--color-accent-soft)' }}
                  >
                    <Icon size={18} />
                    {label}
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Settings Group - Expandable */}
          <div className="my-2" style={{ borderColor: 'var(--color-accent-soft)', borderTopWidth: '1px', opacity: 0.3 }} />
          <div className="space-y-1">
            <button
              onClick={() => setSettingsExpanded(!settingsExpanded)}
              className="w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-sm font-medium hover:opacity-90 transition-colors"
              style={{ color: 'var(--color-accent-soft)' }}
            >
              <div className="flex items-center gap-3">
                <Settings size={18} />
                <span>Einstellungen</span>
              </div>
              <ChevronDown
                size={16}
                style={{
                  transform: settingsExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 0.2s',
                }}
              />
            </button>

            {/* Expanded Settings Items */}
            {settingsExpanded && (
              <div className="space-y-1 pl-2">
                {USER_NAV_ITEMS.map(({ href, icon: Icon, label }) => (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setSidebarOpen(false)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium hover:opacity-90 transition-colors"
                    style={{ color: 'var(--color-accent-soft)' }}
                  >
                    <Icon size={18} />
                    {label}
                  </Link>
                ))}

                {/* Admin Settings - Only if user is loaded and has permission */}
                {!userLoading && ADMIN_NAV_ITEMS.length > 0 && (
                  <>
                    <div className="my-1" style={{ borderColor: 'var(--color-accent-soft)', borderTopWidth: '1px', opacity: 0.2 }} />
                    {ADMIN_NAV_ITEMS.map(({ href, icon: Icon, label }) => (
                      <Link
                        key={href}
                        href={href}
                        onClick={() => setSidebarOpen(false)}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium hover:opacity-90 transition-colors"
                        style={{ color: 'var(--color-accent-soft)' }}
                      >
                        <Icon size={18} />
                        {label}
                      </Link>
                    ))}
                  </>
                )}
              </div>
            )}
          </div>
        </nav>
        <div className="px-4 py-4" style={{ borderColor: 'var(--color-border-strong)', borderTopWidth: '1px' }}>
          <div className="flex items-center gap-3">
            <UserButton appearance={{ elements: { avatarBox: "w-8 h-8" } }} />
            <p className="text-xs" style={{ color: 'var(--color-accent-soft)' }}>
              {t("common.loggedIn")}
            </p>
          </div>
        </div>
      </aside>

      {/* Overlay */}
      {sidebarOpen && <div className="fixed inset-0 bg-black/50 md:hidden z-30" onClick={() => setSidebarOpen(false)} />}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header
          className="px-4 md:px-8 py-4 flex items-center justify-between flex-shrink-0"
          style={{
            backgroundColor: 'var(--color-surface)',
            borderColor: 'var(--color-border)',
            borderBottomWidth: '1px',
          }}
        >
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="md:hidden p-2 rounded-lg transition-colors" style={{ color: 'var(--color-fg)' }}>
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          <span
            className="text-xs px-2.5 py-1 rounded-full font-medium"
            style={{
              backgroundColor: 'var(--color-accent-soft)',
              color: 'var(--color-accent-text)',
            }}
          >
            {praxis?.tenantName || 'Demo-Praxis'}
          </span>
        </header>
        <main className="flex-1 overflow-auto" style={{ backgroundColor: 'var(--color-bg)' }}>
          <div className="p-4 md:p-8" style={{ color: 'var(--color-fg)' }}>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
