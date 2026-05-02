import { UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { HealthStatus } from "@/components/HealthStatus";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <div className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-6 border-b border-gray-200">
          <h1 className="text-xl font-bold text-gray-900">Vet Cloud Admin</h1>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-2">
          <Link
            href="/dashboard"
            className="block px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition"
          >
            Übersicht
          </Link>
          <Link
            href="/dashboard/tenants"
            className="block px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition"
          >
            Mandanten
          </Link>
          <Link
            href="/dashboard/logs"
            className="block px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition"
          >
            Fehlerprotokoll
          </Link>
          <Link
            href="/dashboard/reminders"
            className="block px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition"
          >
            Reminder E-Mails
          </Link>
        </nav>

        <div className="p-4 border-t border-gray-200 space-y-3">
          <HealthStatus />
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-700">Admin</span>
            <UserButton afterSignOutUrl="/sign-in" />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-auto">
          <main className="p-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
