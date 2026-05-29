"use client";

import { ReactNode, useMemo, useState } from "react";
import { UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Calendar, Users, Phone, ClipboardList, Clock, Menu, X, Settings, ChevronDown, User, Building2, Syringe, TrendingUp, Globe2, PawPrint, MessageSquare } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { useLocale } from "@/lib/user/preferences-context";
import { usePraxis } from "@/lib/praxis/context";
import { getSystemDomain } from "@/lib/system-name";
import { PERMISSIONS } from "@/lib/db/schema";
import { useFeatureTracking } from "@/lib/analytics/use-feature-tracking";
import { DashboardFeedbackDialog, inferFeedbackModule } from "@/components/feedback/dashboard-feedback-dialog";
import { ModuleTestingPrompt } from "@/components/feedback/module-testing-prompt";

function useNavItems() {
  const { t } = useLocale();
  return [
    { href: "/dashboard", icon: LayoutDashboard, labelKey: "navigation.overview" },
    { href: "/dashboard/schedule", icon: Calendar, labelKey: "navigation.calendar" },
    { href: "/dashboard/appointments", icon: Clock, labelKey: "navigation.appointments" },
    { href: "/dashboard/clients", icon: Users, labelKey: "navigation.clients" },
    { href: "/dashboard/patients", icon: PawPrint, labelKey: "navigation.animals" },
    { href: "/dashboard/vaccinations", icon: Syringe, label: "Impfungen" },
    { href: "/dashboard/bookings", icon: ClipboardList, labelKey: "navigation.bookings" },
    { href: "/dashboard/statistics", icon: TrendingUp, labelKey: "navigation.statistics" },
  ].map(item => ({ ...item, label: item.label ?? t(item.labelKey) }));
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
  const { data: websiteProjects } = trpc.websitePlatform.listProjects.useQuery();
  const websiteHref = websiteProjects?.[0]?.id
    ? `/dashboard/websites/${websiteProjects[0].id}/editor`
    : "/dashboard/websites";
  return [
    { href: websiteHref, icon: Globe2, label: "Website", adminOnly: true },
    { href: "/dashboard/settings", icon: Building2, labelKey: "navigation.settings", label: t("navigation.settings"), adminOnly: true },
  ];
}

export default function DashboardContent({ children }: { children: ReactNode }) {
  useFeatureTracking();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [settingsExpanded, setSettingsExpanded] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const pathname = usePathname();
  const { praxis } = usePraxis(); // Tenant name already loaded server-side
  const { data: permissions, isLoading: permissionsLoading, isFetched: permissionsFetched } =
    trpc.admin.getUserPermissions.useQuery();
  const { data: featureFlags } = trpc.tenant.getFeatureFlags.useQuery();
  const { data: deletionStatus } = trpc.tenant.getDeletionStatus.useQuery();
  const { t } = useLocale();
  const systemDomain = getSystemDomain();
  const NAV_ITEMS = useNavItems();
  const BETA_NAV_ITEMS = useBetaNavItems();
  const USER_NAV_ITEMS = useUserNavItems();
  const ADMIN_NAV_ITEMS = useAdminNavItems();
  const currentFeedbackModule = inferFeedbackModule(pathname);
  const testingPrompt = useMemo(() => getTestingPrompt(pathname), [pathname]);
  const canManageSettings = Boolean(
    permissionsFetched &&
      permissions &&
      permissions.includes(PERMISSIONS.SETTINGS_MANAGE)
  );

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
                <p className="font-bold text-sm leading-tight">{praxis?.tenantName || systemDomain}</p>
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

                {/* Admin Settings - hidden by default until permissions are loaded */}
                {!permissionsLoading && canManageSettings && ADMIN_NAV_ITEMS.length > 0 && (
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
          <button
            type="button"
            onClick={() => {
              setSidebarOpen(false);
              setFeedbackOpen(true);
            }}
            className="mb-3 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors hover:opacity-90"
            style={{ color: 'var(--color-accent-soft)' }}
            data-testid="sidebar-feedback-button"
          >
            <MessageSquare size={18} />
            Feedback
          </button>
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
        {/* Mobile header with hamburger */}
        <div className="md:hidden px-4 py-3 flex items-center flex-shrink-0" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)', borderBottomWidth: '1px' }}>
          <button onClick={() => setSidebarOpen(true)} className="p-2 rounded-lg transition-colors" style={{ color: 'var(--color-fg)' }}>
            <Menu size={20} />
          </button>
        </div>

        <main className="flex-1 overflow-auto" style={{ backgroundColor: 'var(--color-bg)' }}>
          <div className="p-4 md:p-8" style={{ color: 'var(--color-fg)' }}>
            {deletionStatus?.isDeactivationScheduled && deletionStatus.scheduledFor && (
              <div
                className="mb-4 rounded-lg border px-4 py-3 text-sm"
                style={{
                  backgroundColor: "#fef2f2",
                  borderColor: "#fecaca",
                  color: "#991b1b",
                }}
              >
                <p className="font-semibold">Praxis ist deaktiviert</p>
                <p>
                  Diese Praxis wurde pausiert und zur Löschung vorgemerkt für{" "}
                  {new Date(deletionStatus.scheduledFor).toLocaleDateString("de-DE")}.{" "}
                  Reaktivierung ist über den E-Mail-Link möglich oder durch einen System-Admin.
                </p>
              </div>
            )}
            {testingPrompt && (
              <ModuleTestingPrompt
                moduleKey={testingPrompt.moduleKey}
                moduleName={testingPrompt.moduleName}
                sourcePath={pathname}
              />
            )}
            {children}
          </div>
        </main>
      </div>
      <DashboardFeedbackDialog
        open={feedbackOpen}
        onOpenChange={setFeedbackOpen}
        defaultSourceModule={currentFeedbackModule}
      />
    </div>
  );
}

function getTestingPrompt(pathname: string): { moduleKey: string; moduleName: string } | null {
  if (pathname.includes("/book/") || pathname.startsWith("/dashboard/bookings")) {
    return null;
  }

  if (/^\/dashboard\/patients\/[^/]+/.test(pathname)) {
    return { moduleKey: "medical-records", moduleName: "Krankenakte" };
  }

  const testingModules: Record<string, { moduleKey: string; moduleName: string }> = {
    "/dashboard/clients": { moduleKey: "clients", moduleName: "Kundenverwaltung" },
    "/dashboard/patients": { moduleKey: "patients", moduleName: "Tierverwaltung" },
    "/dashboard/appointments": { moduleKey: "appointments", moduleName: "Termine" },
    "/dashboard/schedule": { moduleKey: "schedule", moduleName: "Kalender" },
    "/dashboard/vaccinations": { moduleKey: "vaccinations", moduleName: "Impfungen" },
    "/dashboard/statistics": { moduleKey: "statistics", moduleName: "Statistiken" },
    "/dashboard/voice": { moduleKey: "voice", moduleName: "KI-Rezeption" },
    "/dashboard/websites": { moduleKey: "website-builder", moduleName: "Website" },
    "/dashboard/settings": { moduleKey: "settings", moduleName: "Einstellungen" },
  };

  const match = Object.entries(testingModules)
    .sort((a, b) => b[0].length - a[0].length)
    .find(([prefix]) => pathname === prefix || pathname.startsWith(`${prefix}/`));

  return match?.[1] ?? null;
}
