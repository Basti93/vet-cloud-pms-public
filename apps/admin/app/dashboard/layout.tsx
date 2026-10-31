"use client";

import { useState } from "react";
import { UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { getSystemDomain } from "@/lib/system-name";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();
  const systemDomain = getSystemDomain();
  const { data: badge } = trpc.adminDashboard.emailLogs.getFailureBadge.useQuery(
    undefined,
    { refetchInterval: 300_000, refetchOnWindowFocus: false }
  );

  const closeMobileMenu = () => setMobileMenuOpen(false);

  return (
    <div className="flex min-h-screen flex-col bg-gray-50 md:h-screen md:flex-row">
      {/* Sidebar */}
      <div className="w-full border-b border-gray-200 bg-white md:w-64 md:border-b-0 md:border-r md:flex md:flex-col">
        <div className="flex items-center justify-between border-b border-gray-200 p-4 md:block md:p-6">
          <h1 className="text-xl font-bold text-gray-900">{systemDomain} Admin</h1>
          <button
            type="button"
            className="inline-flex items-center rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 md:hidden"
            onClick={() => setMobileMenuOpen((v) => !v)}
            aria-label="Menü öffnen"
            aria-expanded={mobileMenuOpen}
          >
            ☰
          </button>
        </div>

        <nav
          className={`px-4 py-4 md:flex-1 md:px-4 md:py-6 ${
            mobileMenuOpen ? "block" : "hidden md:block"
          }`}
        >
          <div className="space-y-2">
          <Link
            href="/dashboard"
            className="block rounded-lg px-4 py-2 text-gray-700 transition hover:bg-gray-100"
            onClick={closeMobileMenu}
          >
            Übersicht
          </Link>
          <Link
            href="/dashboard/tenants"
            className="block rounded-lg px-4 py-2 text-gray-700 transition hover:bg-gray-100"
            onClick={closeMobileMenu}
          >
            Mandanten
          </Link>
          <Link
            href="/dashboard/logs"
            className="block rounded-lg px-4 py-2 text-gray-700 transition hover:bg-gray-100"
            onClick={closeMobileMenu}
          >
            Fehlerprotokoll
          </Link>
          <Link
            href="/dashboard/emails"
            className="flex items-center justify-between rounded-lg px-4 py-2 text-gray-700 transition hover:bg-gray-100"
            onClick={closeMobileMenu}
          >
            <span>E-Mail Log</span>
            {(badge?.failedLast24h ?? 0) > 0 && (
              <span className="ml-2 rounded-full bg-red-500 px-1.5 py-0.5 text-xs font-bold text-white">
                {badge!.failedLast24h}
              </span>
            )}
          </Link>
          <Link
            href="/dashboard/reminders"
            className="block rounded-lg px-4 py-2 text-gray-700 transition hover:bg-gray-100"
            onClick={closeMobileMenu}
          >
            Reminder E-Mails
          </Link>
          <Link
            href="/dashboard/feedback"
            className={`block rounded-lg px-4 py-2 transition ${
              pathname === "/dashboard/feedback"
                ? "bg-gray-100 font-semibold text-gray-900"
                : "text-gray-700 hover:bg-gray-100"
            }`}
            onClick={closeMobileMenu}
          >
            Feedback
          </Link>
          <Link
            href="/dashboard/vaccinations"
            className="block rounded-lg px-4 py-2 text-gray-700 transition hover:bg-gray-100"
            onClick={closeMobileMenu}
          >
            Impf-Reminder
          </Link>
          <Link
            href="/dashboard/audit"
            className={`block rounded-lg px-4 py-2 transition ${
              pathname === "/dashboard/audit"
                ? "bg-gray-100 font-semibold text-gray-900"
                : "text-gray-700 hover:bg-gray-100"
            }`}
            onClick={closeMobileMenu}
          >
            Audit-Log
          </Link>
          <Link
            href="/dashboard/analytics"
            className={`block rounded-lg px-4 py-2 transition ${
              pathname === "/dashboard/analytics"
                ? "bg-gray-100 font-semibold text-gray-900"
                : "text-gray-700 hover:bg-gray-100"
            }`}
            onClick={closeMobileMenu}
          >
            Analytics
          </Link>
          </div>
        </nav>

        <div className="space-y-3 border-t border-gray-200 p-4 md:mt-auto">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-700">Admin</span>
            <UserButton />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="flex-1 overflow-auto">
          <main className="p-4 md:p-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
