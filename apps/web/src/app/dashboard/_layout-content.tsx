"use client";

import { ReactNode, useState } from "react";
import { UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { LayoutDashboard, Calendar, Users, Phone, ClipboardList, Clock, Menu, X, Settings, TrendingUp } from "lucide-react";
import { trpc } from "@/lib/trpc/client";

const NAV_ITEMS = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Übersicht" },
  { href: "/dashboard/schedule", icon: Calendar, label: "Terminkalender" },
  { href: "/dashboard/appointments", icon: Clock, label: "Termine" },
  { href: "/dashboard/patients", icon: Users, label: "Patienten" },
  { href: "/dashboard/bookings", icon: ClipboardList, label: "Buchungsanfragen" },
  { href: "/dashboard/voice", icon: Phone, label: "AI-Rezeption" },
  { href: "/dashboard/statistics", icon: TrendingUp, label: "Statistiken" },
];

const ADMIN_NAV_ITEMS = [
  { href: "/dashboard/settings", icon: Settings, label: "Praxisverwaltung", adminOnly: true },
];

export default function DashboardContent({ children }: { children: ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { data: tenant } = trpc.tenant.getCurrent.useQuery();
  const { data: user, isLoading: userLoading } = trpc.admin.getCurrentUser.useQuery();

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
                VC
              </div>
              <div>
                <p className="font-bold text-sm leading-tight">Vet Cloud</p>
                <p className="text-xs leading-tight" style={{ color: 'var(--color-accent-soft)' }}>
                  Praxisverwaltung
                </p>
              </div>
            </div>
            <button onClick={() => setSidebarOpen(false)} className="md:hidden p-1 hover:opacity-80 rounded-lg transition-colors">
              <X size={20} />
            </button>
          </div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
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
          {!userLoading && (
            <>
              <div className="my-2" style={{ borderColor: 'var(--color-accent-soft)', borderTopWidth: '1px', opacity: 0.3 }} />
              {ADMIN_NAV_ITEMS.map(({ href, icon: Icon, label }) => (
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
            </>
          )}
        </nav>
        <div className="px-4 py-4" style={{ borderColor: 'var(--color-border-strong)', borderTopWidth: '1px' }}>
          <div className="flex items-center gap-3">
            <UserButton appearance={{ elements: { avatarBox: "w-8 h-8" } }} />
            <p className="text-xs" style={{ color: 'var(--color-accent-soft)' }}>
              Angemeldet
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
            {tenant?.name || 'Demo-Praxis'}
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
